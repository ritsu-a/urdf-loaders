/* globals */
import * as THREE from 'three';
import { registerDragEvents } from './dragAndDrop.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import URDFManipulator from '../../src/urdf-manipulator-element.js';

// 全局变量
let audioUrl = null;
let csvUrl = null;
let audioPlayer = null;

// DOM元素
const textInput = document.getElementById('text-input');
const generateBtn = document.getElementById('generate-btn');
const playBtn = document.getElementById('play-btn');
const recordBtn = document.getElementById('record-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const progressBar = document.getElementById('progress-bar');
const progress = document.getElementById('progress');
const playAudioBtn = document.getElementById('play-audio');
const downloadAudioBtn = document.getElementById('download-audio');
const previewCsvBtn = document.getElementById('preview-csv');
const downloadCsvBtn = document.getElementById('download-csv');
const recordingIndicator = document.getElementById('recording-indicator');

// 模型控制元素
const modelOptions = document.querySelectorAll('#urdf-options li');
const autocenterToggle = document.getElementById('autocenter-toggle');
const collisionToggle = document.getElementById('collision-toggle');
const animateToggle = document.getElementById('do-animate');
const hideFixedToggle = document.getElementById('hide-fixed');

// 设置初始模型
let currentModel = "G1_inspire_hands";

// 更新状态显示
function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    
    // 根据类型设置样式
    statusEl.className = 'status';
    if (type === 'error') {
        statusEl.style.backgroundColor = 'rgba(255, 50, 50, 0.2)';
    } else if (type === 'success') {
        statusEl.style.backgroundColor = 'rgba(50, 205, 50, 0.2)';
    } else if (type === 'warning') {
        statusEl.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
    } else if (type === 'recording') {
        statusEl.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    }
}

// 更新进度条
function updateProgress(percentage) {
    progressBar.style.display = 'block';
    progress.style.width = `${percentage}%`;
}

// 生成文件
generateBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) {
        showStatus('请输入文本', 'error');
        return;
    }
    
    showStatus('正在生成文件...', 'info');
    updateProgress(30);
    resultsEl.style.display = 'block';
    
    try {
        // 发送请求到后端API
        const response = await fetch('http://localhost:3001/generate-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        updateProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '文件生成失败');
        }
        
        const result = await response.json();
        
        // 保存文件URL
        audioUrl = result.audioUrl;
        csvUrl = result.csvUrl;
        
        showStatus('文件生成成功!', 'success');
        updateProgress(100);
        
        // 更新下载链接
        downloadAudioBtn.href = audioUrl;
        downloadCsvBtn.href = csvUrl;
        
        // 稍后隐藏进度条
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 2000);
    } catch (error) {
        showStatus(`生成失败: ${error.message}`, 'error');
        progressBar.style.display = 'none';
        console.error('生成错误:', error);
    }
});

// 播放音频
playAudioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!audioUrl) {
        showStatus('请先生成音频文件', 'warning');
        return;
    }
    
    showStatus('正在播放音频...', 'info');
    
    // 停止当前播放的音频
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    
    // 创建新的音频播放器
    audioPlayer = new Audio(audioUrl);
    audioPlayer.play().catch(error => {
        showStatus(`播放错误: ${error.message}`, 'error');
    });
    
    // 播放结束处理
    audioPlayer.onended = () => {
        showStatus('音频播放完成', 'success');
    };
});

// 预览CSV
previewCsvBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!csvUrl) {
        showStatus('请先生成CSV文件', 'warning');
        return;
    }
    
    // 在新窗口打开CSV文件
    window.open(csvUrl, '_blank');
    showStatus('在新窗口中预览CSV文件', 'info');
});

// 播放结果（音频+动画）
playBtn.addEventListener('click', () => {
    if (!audioUrl || !csvUrl) {
        showStatus('请先生成文件', 'warning');
        return;
    }
    
    showStatus('播放音频并执行机器人动画...', 'info');
    
    // 播放音频
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    
    audioPlayer = new Audio(audioUrl);
    audioPlayer.play().catch(error => {
        showStatus(`播放错误: ${error.message}`, 'error');
    });
    
    // 模拟动画执行
    animateRobot();
    
    // 播放结束处理
    audioPlayer.onended = () => {
        showStatus('音频播放和动画执行完成', 'success');
    };
});

// 录制音频按钮
recordBtn.addEventListener('click', async () => {
    // 在实际应用中实现录音功能
    showStatus('录音中...', 'recording');
    recordingIndicator.style.display = 'flex';
    
    // 模拟录音过程
    setTimeout(() => {
        recordingIndicator.style.display = 'none';
        showStatus('录音完成，使用生成的音频文件', 'success');
        
        // 在实际应用中，这里会设置录制的音频URL
        // audioUrl = "recorded-audio.wav";
        // downloadAudioBtn.href = audioUrl;
    }, 3000);
});

// 模拟机器人动画
function animateRobot() {
    // 在实际应用中，这里会使用CSV数据驱动URDF模型
    showStatus('执行机器人动画...', 'info');
}

// 模型选择功能
modelOptions.forEach(option => {
    option.addEventListener('click', function() {
        // 移除之前的选择
        modelOptions.forEach(opt => opt.classList.remove('selected'));
        
        // 设置当前选择
        this.classList.add('selected');
        currentModel = this.textContent;
        
        // 更新模型信息
        updateModelInfo();
        
        showStatus(`已切换到模型: ${currentModel}`, 'info');
    });
});

// 模型控制功能
autocenterToggle.addEventListener('click', function() {
    this.classList.toggle('checked');
    showStatus(`自动居中: ${this.classList.contains('checked') ? '开启' : '关闭'}`, 'info');
});

collisionToggle.addEventListener('click', function() {
    this.classList.toggle('checked');
    showStatus(`显示碰撞模型: ${this.classList.contains('checked') ? '开启' : '关闭'}`, 'info');
});

animateToggle.addEventListener('click', function() {
    this.classList.toggle('checked');
    showStatus(`动画关节: ${this.classList.contains('checked') ? '开启' : '关闭'}`, 'info');
});

hideFixedToggle.addEventListener('click', function() {
    this.classList.toggle('checked');
    showStatus(`隐藏固定关节: ${this.classList.contains('checked') ? '开启' : '关闭'}`, 'info');
});

// 更新模型信息
function updateModelInfo() {
    const info = document.getElementById('model-info');
    if (currentModel === "G1_inspire_hands") {
        info.innerHTML = `
            <p><strong>当前模型:</strong> G1_inspire_hands</p>
            <p><strong>关节数:</strong> 24</p>
            <p><strong>自由度:</strong> 20</p>
        `;
    } else if (currentModel === "UR5机械臂") {
        info.innerHTML = `
            <p><strong>当前模型:</strong> UR5机械臂</p>
            <p><strong>关节数:</strong> 6</p>
            <p><strong>自由度:</strong> 6</p>
        `;
    } else {
        info.innerHTML = `
            <p><strong>当前模型:</strong> Turtlebot机器人</p>
            <p><strong>关节数:</strong> 8</p>
            <p><strong>自由度:</strong> 3</p>
        `;
    }
}

// 初始化
updateModelInfo();

// 设置下载按钮事件
downloadAudioBtn.addEventListener('click', function(e) {
    if (!audioUrl) {
        e.preventDefault();
        showStatus('请先生成音频文件', 'warning');
    }
});

downloadCsvBtn.addEventListener('click', function(e) {
    if (!csvUrl) {
        e.preventDefault();
        showStatus('请先生成CSV文件', 'warning');
    }
});
