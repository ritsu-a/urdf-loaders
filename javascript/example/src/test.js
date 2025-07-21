/* globals */
import * as THREE from 'three';
import { registerDragEvents } from './dragAndDrop.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import URDFManipulator from '../../src/urdf-manipulator-element.js';

customElements.define('urdf-viewer', URDFManipulator);

// declare these globally for the sake of the example.
// Hack to make the build work with webpack for now.
// TODO: Remove this once modules or parcel is being used
const viewer = document.querySelector('urdf-viewer');

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

// const limitsToggle = document.getElementById('ignore-joint-limits');
const collisionToggle = document.getElementById('collision-toggle');
// const radiansToggle = document.getElementById('radians-toggle');
const autocenterToggle = document.getElementById('autocenter-toggle');
// const upSelect = document.getElementById('up-select');
// const sliderList = document.querySelector('#controls ul');
// const controlsel = document.getElementById('controls');
// const controlsToggle = document.getElementById('toggle-controls');
const animToggle = document.getElementById('do-animate');
const hideFixedToggle = document.getElementById('hide-fixed');
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 1 / DEG2RAD;
let sliders = {};

// Animation variables
let animationFrames = [];   // 存储所有帧数据
let currentFrame = 0;       // 当前帧索引
let isPlaying = false;      // 播放状态
let playInterval;           // 播放计时器
let frameRate = 20;         // 默认帧率(帧/秒)


// 全局变量
let audioUrl = null;
let csvUrl = null;
let audioPlayer = null;



// 设置初始模型
let currentModel = "G1_inspire_hands";

// Global Functions
const setColor = color => {

    document.body.style.backgroundColor = color;
    viewer.highlightColor = '#' + (new THREE.Color(0xffffff)).lerp(new THREE.Color(color), 0.35).getHexString();

};

// watch for urdf changes
viewer.addEventListener('urdf-change', () => {

    Object
        .values(sliders)
        .forEach(sl => sl.remove());
    sliders = {};

});

viewer.addEventListener('ignore-limits-change', () => {

    Object
        .values(sliders)
        .forEach(sl => sl.update());

});

viewer.addEventListener('angle-change', e => {

    if (sliders[e.detail]) sliders[e.detail].update();

});

viewer.addEventListener('joint-mouseover', e => {

    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) j.setAttribute('robot-hovered', true);

});

viewer.addEventListener('joint-mouseout', e => {

    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) j.removeAttribute('robot-hovered');

});

let originalNoAutoRecenter;
viewer.addEventListener('manipulate-start', e => {

    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) {
        j.scrollIntoView({ block: 'nearest' });
        window.scrollTo(0, 0);
    }

    originalNoAutoRecenter = viewer.noAutoRecenter;
    viewer.noAutoRecenter = true;

});

viewer.addEventListener('manipulate-end', e => {

    viewer.noAutoRecenter = originalNoAutoRecenter;

});

// create the sliders
viewer.addEventListener('urdf-processed', () => {

    const r = viewer.robot;
    Object
        .keys(r.joints)
        // .sort((a, b) => {

        //     const da = a.split(/[^\d]+/g).filter(v => !!v).pop();
        //     const db = b.split(/[^\d]+/g).filter(v => !!v).pop();

        //     if (da !== undefined && db !== undefined) {
        //         const delta = parseFloat(da) - parseFloat(db);
        //         if (delta !== 0) return delta;
        //     }

        //     if (a > b) return 1;
        //     if (b > a) return -1;
        //     return 0;

        // })
        .map(key => r.joints[key])
        .forEach(joint => {

            const li = document.createElement('li');
            li.innerHTML =
            `
            <span title="${ joint.name }">${ joint.name }</span>
            <input type="range" value="0" step="0.0001"/>
            <input type="number" step="0.0001" />
            `;
            li.setAttribute('joint-type', joint.jointType);
            li.setAttribute('joint-name', joint.name);

            sliderList.appendChild(li);

            // update the joint display
            const slider = li.querySelector('input[type="range"]');
            const input = li.querySelector('input[type="number"]');
            li.update = () => {
                const degMultiplier = radiansToggle.classList.contains('checked') ? 1.0 : RAD2DEG;
                let angle = joint.angle;

                if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
                    angle *= degMultiplier;
                }

                if (Math.abs(angle) > 1) {
                    angle = angle.toFixed(1);
                } else {
                    angle = angle.toPrecision(2);
                }

                input.value = parseFloat(angle);

                // directly input the value
                slider.value = joint.angle;

                if (viewer.ignoreLimits || joint.jointType === 'continuous') {
                    slider.min = -6.28;
                    slider.max = 6.28;

                    input.min = -6.28 * degMultiplier;
                    input.max = 6.28 * degMultiplier;
                } else {
                    slider.min = joint.limit.lower;
                    slider.max = joint.limit.upper;

                    input.min = joint.limit.lower * degMultiplier;
                    input.max = joint.limit.upper * degMultiplier;
                }
            };

            switch (joint.jointType) {

                case 'continuous':
                case 'prismatic':
                case 'revolute':
                    break;
                default:
                    li.update = () => {};
                    input.remove();
                    slider.remove();

            }

            // slider.addEventListener('input', () => {
            //     viewer.setJointValue(joint.name, slider.value);
            //     li.update();
            // });

            // input.addEventListener('change', () => {
            //     const degMultiplier = radiansToggle.classList.contains('checked') ? 1.0 : DEG2RAD;
            //     viewer.setJointValue(joint.name, input.value * degMultiplier);
            //     li.update();
            // });

            li.update();

            sliders[joint.name] = li;

        });

});


document.addEventListener('WebComponentsReady', () => {

    viewer.loadMeshFunc = (path, manager, done) => {

        const ext = path.split(/\./g).pop().toLowerCase();
        switch (ext) {

            case 'gltf':
            case 'glb':
                new GLTFLoader(manager).load(
                    path,
                    result => done(result.scene),
                    null,
                    err => done(null, err),
                );
                break;
            case 'obj':
                new OBJLoader(manager).load(
                    path,
                    result => done(result),
                    null,
                    err => done(null, err),
                );
                break;
            case 'dae':
                new ColladaLoader(manager).load(
                    path,
                    result => done(result.scene),
                    null,
                    err => done(null, err),
                );
                break;
            case 'stl':
                new STLLoader(manager).load(
                    path,
                    result => {
                        const material = new THREE.MeshPhongMaterial();
                        const mesh = new THREE.Mesh(result, material);
                        done(mesh);
                    },
                    null,
                    err => done(null, err),
                );
                break;

        }

    };

    document.querySelector('li[urdf]').dispatchEvent(new Event('click'));

    if (/javascript\/example\/bundle/i.test(window.location)) {
        viewer.package = '../../../urdf';
    }

    registerDragEvents(viewer, () => {
        setColor('#263238');
        animToggle.classList.remove('checked');
        updateList();
    });

    viewer.up = '+Z';
    // upSelect.value = '+Z';

});

const updateLoop = () => {

    // if (animToggle.classList.contains('checked')) {
    //     updateAngles();
    // }

    requestAnimationFrame(updateLoop);

};

const updateList = () => {

    document.querySelectorAll('#urdf-options li[urdf]').forEach(el => {

        el.addEventListener('click', e => {

            const urdf = e.target.getAttribute('urdf');
            const color = e.target.getAttribute('color');

            viewer.up = '+Z';
            document.getElementById('up-select').value = viewer.up;
            viewer.urdf = urdf;
            animToggle.classList.add('checked');
            setColor(color);

        });

    });

};

updateList();

document.addEventListener('WebComponentsReady', () => {

    animToggle.addEventListener('click', () => animToggle.classList.toggle('checked'));

    // stop the animation if user tried to manipulate the model
    viewer.addEventListener('manipulate-start', e => animToggle.classList.remove('checked'));
    // viewer.addEventListener('urdf-processed', e => updateAngles());
    updateLoop();
    viewer.camera.position.set(1.0, 0.0, 1.0);

});



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
        const response = await fetch('http://192.168.51.4:3001/generate-files', {
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
playBtn.addEventListener('click', async () => {
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
    try {
        const response = await fetch(csvUrl);
    
        if (!response.ok) {
            throw new Error(`文件加载失败: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        parseCSVData(csvText);
        showStatus("CSV动画加载成功");
    } catch (error) {
        showStatus(`加载失败: ${error.message}`, "error");
        console.error('CSV解析错误:', error);
    }

    playAnimation();

    audioPlayer.play().catch(error => {
        showStatus(`播放错误: ${error.message}`, 'error');
    });
    
    
    // 播放结束处理
    audioPlayer.onended = () => {
        showStatus('音频播放和动画执行完成', 'success');
    };
});

// CSV数据解析
function parseCSVData(csvText) {
    animationFrames = [];
    
    // 分割CSV行
    const lines = csvText.trim().split('\n');
    
    // 获取关节名称
    const jointNames = ['1', '2', '3', '4', '5', '6', '7', 'left_hip_pitch_joint', 'left_hip_roll_joint', 'left_hip_yaw_joint', 
                    'left_knee_joint', 'left_ankle_pitch_joint', 'left_ankle_roll_joint', 
                    'right_hip_pitch_joint', 'right_hip_roll_joint', 'right_hip_yaw_joint', 
                    'right_knee_joint', 'right_ankle_pitch_joint', 'right_ankle_roll_joint', 
                    'waist_yaw_joint', 'waist_roll_joint', 'waist_pitch_joint', 'left_shoulder_pitch_joint', 
                    'left_shoulder_roll_joint', 'left_shoulder_yaw_joint', 'left_elbow_joint', 
                    'left_wrist_roll_joint', 'left_wrist_pitch_joint', 'left_wrist_yaw_joint', 
                    'L_thumb_proximal_yaw_joint', 'L_thumb_proximal_pitch_joint', 'L_thumb_intermediate_joint', 'L_thumb_distal_joint', 
                    'L_index_proximal_joint', 'L_index_intermediate_joint', 
                    'L_middle_proximal_joint', 'L_middle_intermediate_joint', 
                    'L_ring_proximal_joint', 'L_ring_intermediate_joint', 
                    'L_pinky_proximal_joint', 'L_pinky_intermediate_joint', 
                    'right_shoulder_pitch_joint', 'right_shoulder_roll_joint', 
                    'right_shoulder_yaw_joint', 'right_elbow_joint', 
                    'right_wrist_roll_joint', 'right_wrist_pitch_joint', 'right_wrist_yaw_joint', 
                    'R_thumb_proximal_yaw_joint', 'R_thumb_proximal_pitch_joint', 'R_thumb_intermediate_joint', 'R_thumb_distal_joint', 
                    'R_index_proximal_joint', 'R_index_intermediate_joint', 'R_middle_proximal_joint', 'R_middle_intermediate_joint', 
                    'R_ring_proximal_joint', 'R_ring_intermediate_joint', 'R_pinky_proximal_joint', 'R_pinky_intermediate_joint'];
    // 0-7 global 
    // 8-18 lower body
    // 19-28 left arm
    // 29-40 left hand
    // 41-47 right arm
    // 48-59 right hand
    // 处理数据行
    for (let i = 0; i < lines.length; i++) {
        const values = lines[i].split(',');
        const frameData = {};
        
        for (let j = 19; j < 29; j++) {
            const jointName = jointNames[j];
            const angleValue = parseFloat(values[j]);
            
            if (!isNaN(angleValue)) {
                frameData[jointName] = angleValue;
            }
        }
        for (let j = 41; j < 48; j++) {
            const jointName = jointNames[j];
            const angleValue = parseFloat(values[j-12]);
            
            if (!isNaN(angleValue)) {
                frameData[jointName] = angleValue;
            }
        }
        
        animationFrames.push(frameData);
    }
    
    // 更新
    currentFrame = 0;
    console.log(`加载了${animationFrames.length}帧动画数据`);
}

// 播放控制函数
function playAnimation() {
    if (animationFrames.length === 0) return;
    
    isPlaying = true;
    const frameDelay = 1000 / frameRate; // 毫秒/帧
    
    playInterval = setInterval(() => {
      currentFrame = (currentFrame + 1) % animationFrames.length;
      updateRobotPose();
      
      if (currentFrame === 0) {
        // 循环播放结束
        stopAnimation();
      }
    }, frameDelay);
}

function stopAnimation() {
    isPlaying = false;
    clearInterval(playInterval);
}

function updateRobotPose() {
    if (!viewer.setJointValues || currentFrame >= animationFrames.length) return;
    
    const frameData = animationFrames[currentFrame];
    viewer.setJointValues(frameData);
}


// 录制音频按钮 TODO
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
autocenterToggle.addEventListener('click', () => {
    autocenterToggle.classList.toggle('checked');
    viewer.noAutoRecenter = !autocenterToggle.classList.contains('checked');
});


collisionToggle.addEventListener('click', () => {
    collisionToggle.classList.toggle('checked');
    viewer.showCollision = collisionToggle.classList.contains('checked');
});

animToggle.addEventListener('click', function() {
    this.classList.toggle('checked');
    showStatus(`动画关节: ${this.classList.contains('checked') ? '开启' : '关闭'}`, 'info');
});

hideFixedToggle.addEventListener('click', () => {
    hideFixedToggle.classList.toggle('checked');

    const hideFixed = hideFixedToggle.classList.contains('checked');
    if (hideFixed) controlsel.classList.add('hide-fixed');
    else controlsel.classList.remove('hide-fixed');

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
