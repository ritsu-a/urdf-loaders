// server.js
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 环境配置
dotenv.config();
const LOCAL_IP = '192.168.51.4'
const SERVER_IP = process.env.SERVER_IP || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 6000;

// 获取当前目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

// 创建下载目录
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 存储上一次生成的文件URL
let lastGeneratedFiles = {
    audioUrl: `http://localhost:${port}/data/output.wav`,
    csvUrl: `http://localhost:${port}/data/output.csv`
};

// 处理文件生成请求
app.post('/generate-files', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // 服务器地址
        const serverUrl = `http://${SERVER_IP}:${SERVER_PORT}/generate-files`;
        
        // 发送请求到服务器
        const response = await axios({
            method: 'post',
            url: serverUrl,
            data: { text },
            responseType: 'arraybuffer' // 接收二进制数据
        });

        // 生成唯一目录名
        const timestamp = Date.now();
        const uniqueDir = path.join(downloadsDir, `generated_${timestamp}`);
        if (!fs.existsSync(uniqueDir)) {
            fs.mkdirSync(uniqueDir);
        }

        // 保存ZIP文件
        const zipPath = path.join(uniqueDir, 'files.zip');
        fs.writeFileSync(zipPath, response.data);

        // 解压ZIP
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(uniqueDir, true);

        // 查找解压后的文件
        const files = fs.readdirSync(uniqueDir);
        const audioFile = files.find(f => f.endsWith('.wav'));
        const csvFile = files.find(f => f.endsWith('.csv'));

        if (!audioFile || !csvFile) {
            throw new Error('Missing files in the zip');
        }

        // 更新上一次生成的文件URL
        lastGeneratedFiles = {
            audioUrl: `http://${LOCAL_IP}:${port}/downloads/generated_${timestamp}/${audioFile}`,
            csvUrl: `http://${LOCAL_IP}:${port}/downloads/generated_${timestamp}/${csvFile}`
        };

        console.log('Files generated successfully:', lastGeneratedFiles);

        // 返回本次生成的文件URL
        res.json({
            message: 'Files generated successfully',
            ...lastGeneratedFiles
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'File generation failed',
            details: error.message
        });
    }
});

// 新增：获取上一次生成的文件URL
app.get('/last-generated', (req, res) => {
    if (!lastGeneratedFiles.audioUrl || !lastGeneratedFiles.csvUrl) {
        return res.status(404).json({ 
            error: 'No files generated yet' 
        });
    }
    
    res.json({
        message: 'Last generated files URLs',
        ...lastGeneratedFiles
    });
});

// 提供静态文件服务
app.use('/downloads', express.static(downloadsDir));

// 启动服务器
app.listen(port, () => {
    console.log(`Local proxy server running at http://localhost:${port}`);
    console.log(`Proxying requests to: http://${SERVER_IP}:${SERVER_PORT}`);
    console.log(`Access last generated files at: http://localhost:${port}/last-generated`);
});