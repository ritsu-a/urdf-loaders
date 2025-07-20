import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// 获取当前文件路径（替代 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 创建音频目录
const audioDir = path.join(__dirname, 'data');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// 中间件配置
app.use(cors());
app.use(fileUpload());
app.use(express.static('.')); // 提供静态文件服务

// 音频保存端点
app.post('/upload_audio', (req, res) => {
    if (!req.files || !req.files.audio) {
        return res.status(400).json({ 
            success: false, 
            error: '没有上传音频文件' 
        });
    }

    const audioFile = req.files.audio;
    const filename = req.body.filename || `recording_${Date.now()}.wav`;
    const filePath = path.join(audioDir, filename);

    audioFile.mv(filePath, (err) => {
        if (err) {
            console.error('保存文件错误:', err);
            return res.status(500).json({ 
                success: false, 
                error: '保存文件失败',
                details: err.message 
            });
        }

        console.log(`音频保存成功: ${filename}`);
        res.json({ 
            success: true, 
            message: '音频保存成功',
            filename: filename,
            path: filePath,
            url: `/data/${filename}`  // 添加访问URL
        });
    });
});

// 添加音频文件列表端点
app.get('/audio_files', (req, res) => {
    fs.readdir(audioDir, (err, files) => {
        if (err) {
            console.error('读取音频目录错误:', err);
            return res.status(500).json({ 
                success: false, 
                error: '无法读取音频文件列表' 
            });
        }
        
        // 过滤出音频文件
        const audioFiles = files.filter(file => 
            ['.wav', '.mp3', '.ogg'].includes(path.extname(file).toLowerCase())
        );
        
        res.json({
            success: true,
            files: audioFiles,
            count: audioFiles.length
        });
    });
});

// 提供音频文件访问
app.use('/audio', express.static(audioDir));

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
    console.log(`音频文件保存在: ${audioDir}`);
    console.log(`访问已保存的音频: http://localhost:${PORT}/data/[文件名]`);
});