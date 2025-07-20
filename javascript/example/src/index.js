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

const limitsToggle = document.getElementById('ignore-joint-limits');
const collisionToggle = document.getElementById('collision-toggle');
const radiansToggle = document.getElementById('radians-toggle');
const autocenterToggle = document.getElementById('autocenter-toggle');
const upSelect = document.getElementById('up-select');
const sliderList = document.querySelector('#controls ul');
const controlsel = document.getElementById('controls');
const controlsToggle = document.getElementById('toggle-controls');
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


let controlMode = 'manual'; // 'manual' 或 'animation'
let animationRequestId = null;

// Global Functions
const setColor = color => {

    document.body.style.backgroundColor = color;
    viewer.highlightColor = '#' + (new THREE.Color(0xffffff)).lerp(new THREE.Color(color), 0.35).getHexString();

};

// Events
// toggle checkbox
limitsToggle.addEventListener('click', () => {
    limitsToggle.classList.toggle('checked');
    viewer.ignoreLimits = limitsToggle.classList.contains('checked');
});

radiansToggle.addEventListener('click', () => {
    radiansToggle.classList.toggle('checked');
    Object
        .values(sliders)
        .forEach(sl => sl.update());
});

collisionToggle.addEventListener('click', () => {
    collisionToggle.classList.toggle('checked');
    viewer.showCollision = collisionToggle.classList.contains('checked');
});

autocenterToggle.addEventListener('click', () => {
    autocenterToggle.classList.toggle('checked');
    viewer.noAutoRecenter = !autocenterToggle.classList.contains('checked');
});

hideFixedToggle.addEventListener('click', () => {
    hideFixedToggle.classList.toggle('checked');

    const hideFixed = hideFixedToggle.classList.contains('checked');
    if (hideFixed) controlsel.classList.add('hide-fixed');
    else controlsel.classList.remove('hide-fixed');

});

upSelect.addEventListener('change', () => viewer.up = upSelect.value);

controlsToggle.addEventListener('click', () => controlsel.classList.toggle('hidden'));

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
    upSelect.value = '+Z';

});

// init 2D UI and animation
const updateAngles = () => {

    if (!viewer.setJointValue) return;

    // reset everything to 0 first
    const resetJointValues = viewer.angles;
    for (const name in resetJointValues) resetJointValues[name] = 0;
    viewer.setJointValues(resetJointValues);

    // animate the legs
    const time = Date.now() / 3e2;
    for (let i = 1; i <= 6; i++) {

        const offset = i * Math.PI / 3;
        const ratio = Math.max(0, Math.sin(time + offset));

        viewer.setJointValue(`HP${ i }`, THREE.MathUtils.lerp(30, 0, ratio) * DEG2RAD);
        viewer.setJointValue(`KP${ i }`, THREE.MathUtils.lerp(90, 150, ratio) * DEG2RAD);
        viewer.setJointValue(`AP${ i }`, THREE.MathUtils.lerp(-30, -60, ratio) * DEG2RAD);

        viewer.setJointValue(`TC${ i }A`, THREE.MathUtils.lerp(0, 0.065, ratio));
        viewer.setJointValue(`TC${ i }B`, THREE.MathUtils.lerp(0, 0.065, ratio));

        viewer.setJointValue(`W${ i }`, window.performance.now() * 0.001);

    }

};

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



// 音频控制功能
document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-btn');
    const recordBtn = document.getElementById('record-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const audioStatus = document.getElementById('audio-status');
    
    // 创建音频上下文
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    // 播放音频功能
    playBtn.addEventListener('click', async () => {
        // 播放 audio/output.wav 文件
        const audio = new Audio('../../../data/output.wav');
        
        try {
            const response = await fetch('http://127.0.0.1:9080/data/output.csv');
        
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

        
        // 显示状态
        showStatus("播放中: output.wav", "info");
        

        if (!isPlaying) {
            playAnimation();
        // 播放音频
            audio.play().catch(error => {
                showStatus(`播放错误: ${error.message}`, "error");
                console.error('播放错误:', error);
            });
        }
        
        // 监听播放结束
        audio.onended = () => {
            showStatus("播放完成", "success");
        };
    });

    // 文件读取辅助函数
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsText(file);
        });
      }
      
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



    
    // 录制音频功能
    let mediaRecorder;
    let audioChunks = [];
    
    recordBtn.addEventListener('click', async () => {
        if (!mediaRecorder) {
            // 开始录制
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = () => {
                    // 创建音频Blob
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    
                    // 发送到服务器
                    sendAudioToServer(audioBlob);
                    
                    // 重置
                    audioChunks = [];
                    mediaRecorder = null;
                    
                    // 停止所有轨道
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                recordingIndicator.style.display = 'block';
                recordBtn.querySelector('span').textContent = '停止录制';
                showStatus("录制中... 点击停止按钮结束录制");
            } catch (error) {
                showStatus(`录制错误: ${error.message}`);
                console.error('录音权限错误:', error);
            }
        } else {
            // 停止录制
            mediaRecorder.stop();
            recordingIndicator.style.display = 'none';
            recordBtn.querySelector('span').textContent = '录制音频';
            showStatus("处理录制内容...");
        }
    });
    
    // 显示状态消息
    function showStatus(message) {
        audioStatus.textContent = message;
        audioStatus.style.display = 'block';
        
        // 3秒后隐藏状态
        setTimeout(() => {
            audioStatus.style.display = 'none';
        }, 3000);
    }
    
    // 发送音频到服务器
    function sendAudioToServer(audioBlob) {
        showStatus("正在上传音频到服务器...", "info");
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('audio', audioBlob, 'input.wav');
        formData.append('filename', 'input.wav'); // 指定保存的文件名
        
        // 使用服务器端点保存音频
        fetch('http://localhost:3000/upload_audio', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showStatus(`音频已保存为: ${data.filename}`, "success");
            } else {
                showStatus(`保存失败: ${data.error}`, "error");
            }
        })
        .catch(error => {
            showStatus(`上传失败: ${error.message}`, "error");
            console.error('上传错误:', error);
        });
    }
});
