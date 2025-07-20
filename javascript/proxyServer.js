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

        // 返回两个文件的下载路径
        res.json({
            message: 'Files generated successfully',
            audioUrl: `http://localhost:${port}/downloads/generated_${timestamp}/${audioFile}`,
            csvUrl: `http://localhost:${port}/downloads/generated_${timestamp}/${csvFile}`
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'File generation failed',
            details: error.message
        });
    }
});

// 提供静态文件服务
app.use('/downloads', express.static(downloadsDir));

// 启动服务器
app.listen(port, () => {
    console.log(`Local proxy server running at http://localhost:${port}`);
    console.log(`Proxying requests to: http://${SERVER_IP}:${SERVER_PORT}`);
});