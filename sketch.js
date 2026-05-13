const firebaseConfig = {
  apiKey: "AIzaSyBwmpmsD7of5d7wfoxhgg1IPIC9aPhyOJA",
  authDomain: "a-place-of-resonance.firebaseapp.com",
  databaseURL: "https://a-place-of-resonance-default-rtdb.firebaseio.com",
  projectId: "a-place-of-resonance",
  storageBucket: "a-place-of-resonance.firebasestorage.app",
  messagingSenderId: "192031970906",
  appId: "1:192031970906:web:c0e7423716ed2c37be2a63",
  measurementId: "G-5521DXMT49"
};
// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let qrImg;
let isAudioActivated = false;
let currentAudio;
let isAudioReady = false; // 记录音频是否解析完毕
let mic, fft, amplitude;
let mySong; 
let state = -1; 
let glitchTimer = 0; // 全局定义状态切换计时器
let fileInput;
let isDragging = false;
let dragStartY = 0;
let dragOffset = 0;
let dragThreshold = 200; // 需要拉动 200 像素才能摘下

// 物理声音粒子系统
let bassWaves = [];    
let midStrokes = [];   
let trebleSparks = []; 

// 语义粒子系统
let semanticParticles = []; 
let fallingWords = []; 

// 语音识别系统
let speechRec;
let lastInterim = ""; 
let liveTextDisplay = ""; 
let subtitleAlpha = 0; // 独立控制中心字幕的透明度
let lastRecognizedString = ""; // 用来记录历史，防止文字贪吃蛇式叠加
let speechError = ""; // 优雅的错误处理
let silenceTimer = 0;   
let ambientNoise = 100; // 动态底噪 (程序会自动修正)

// ================= 全局自适应峰值 =================
let peakBass = 100;
let peakMid = 100;
let peakTreble = 100;
let coralParticles = [];    
let isCoralShattered = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  mic = new p5.AudioIn();
  fft = new p5.FFT(0.85, 512); 
  amplitude = new p5.Amplitude(); 

  initSpeechRecognition();

  db.ref('currentMood').on('value', (snapshot) => {
        const mood = snapshot.val();
        if (mood) {
            console.log("云端指令到达，准备切换模式:", mood);
            switchChannel(mood); // 呼叫换台函数
        }
    });
}
function preload() {
    qrImg = loadImage('qrcodetomusicplayer.png'); 
}

function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRec = new SpeechRecognition();
    speechRec.continuous = true;
    speechRec.interimResults = true; 
    speechRec.lang = 'zh-CN';

    speechRec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          let finalStr = event.results[i][0].transcript;
          processNewCharacters(finalStr);
          lastInterim = ""; 
          liveTextDisplay = ""; 
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim !== "") {
        liveTextDisplay = interim; 
        if (interim.startsWith(lastInterim) && interim.length > lastInterim.length) {
          let newChars = interim.substring(lastInterim.length);
          processNewCharacters(newChars);
        } else if (!interim.startsWith(lastInterim)) {
          processNewCharacters(interim.substring(interim.length - 1)); 
        }
        lastInterim = interim;
      }
    };
    
    speechRec.onerror = (event) => {
      console.error("Speech API Error:", event.error);
      if (event.error === 'not-allowed') speechError = "⚠️ 麦克风权限被拒绝，无法生成语义视觉。";
    };

    speechRec.onend = () => { 
      if (state === 2) try { speechRec.start(); } catch(e) {}
    };
  } else {
    speechError = "⚠️ 当前环境不支持语音语义识别\n请复制链接，使用电脑版 Chrome/Edge 浏览器打开以体验完整作品。";
  }
}

function processNewCharacters(chars) {
  for (let i = 0; i < chars.length; i++) {
    let char = chars[i];
    if (/[，。！？、：；（）“”]/g.test(char)) continue;

    // 文字和语义图形随机散布在天空
    let dropX = random(width * 0.1, width * 0.9);
    let dropY = random(height * 0.2, height * 0.5);

    fallingWords.push(new FallingWord(char, dropX, 0));
    semanticParticles.push(new SemanticShape(char, dropX, dropY));
  }
}


function draw() {
  if (state === -1) drawOpening();
  else if (state === 0) drawIsolationMode();
  else if (state === 1) drawGlitchTransition();
  else if (state === 2) drawRealityMirror();
}

function drawOpening() {
  background(260, 60, 5); 
if (state === -1) {
        push(); // 开启保护罩，不影响你后面的视觉效果
        colorMode(RGB, 255, 255, 255, 255); // 强行切回普通的 RGB 模式
        background(0); // 纯黑底色
        
        textAlign(CENTER, CENTER);
        
        if (!isAudioActivated) {
            // 还没点击时，显示大白字
            fill(255); 
            textSize(32);
            text("请点击屏幕任意位置以激活共鸣空间", width / 2, height / 2);
        } else {
            // 点击激活后，显示二维码和提示
            if (qrImg) {
                imageMode(CENTER);
                image(qrImg, width / 2, height / 2 - 50, 250, 250);
            } else {
                fill(100); // 如果还没准备好图片，显示一个灰色方块占位
                rectMode(CENTER);
                rect(width / 2, height / 2 - 50, 250, 250);
                fill(255);
                text("二维码图片未找到 (qrcodetomusicplayer.png)", width / 2, height / 2 - 50);
            }
            
            fill(255);
            textSize(24);
            text("请用手机扫描二维码，选择你的频道", width / 2, height / 2 + 120);
            
            // 呼吸灯效果
            let alpha = abs(sin(frameCount * 0.05)) * 255;
            fill(255, 255, 255, alpha);
            textSize(16);
            text("系统已就绪，正在等待信号接入...", width / 2, height / 2 + 160);
        }
        pop(); // 卸下保护罩
        return; // 结束，不执行后面的小人代码
    }
}

// --- 状态0：数字茧房 (重塑版) ---
function drawIsolationMode() {
  background(260, 60, 10); // 深邃底色

  // 1. 绘制虚无的路径 (由音乐频率微弱驱动的细线)
  let spectrum = fft.analyze();
  stroke(200, 50, 100, 30); // 极淡的冷光
  strokeWeight(1);
  noFill();
  beginShape();
  for (let i = 0; i < width; i += 10) {
    // 细线随波形轻微颤动
    let index = floor(map(i, 0, width, 0, spectrum.length / 4));
    let h = map(spectrum[index], 0, 255, 0, 15); 
    vertex(i, height / 2 + 100 + h); 
  }
  endShape();

  // 2. 绘制漫步者 (重塑尺寸与替身版)
  push();
  translate(width / 2, height / 2 + 100);
  
  // 【精准修改 1】：把原本的 scale(0.2) 放大到 scale(1.0)
  scale(1.0); 

  // 【精准修改 2】：把 drawWalkingPerson 换成带耳机的 drawIsolatedAvatar
  let vol = mySong && mySong.isPlaying() ? amplitude.getLevel() : 0;
  drawIsolatedAvatar(vol, 1.0); 
  
  pop();

  // 3. 提示文字 (改在下方微弱显示)
        if (currentAudio && currentAudio.isPlaying()) {
            push(); // 保护颜色模式
            colorMode(HSB, 360, 100, 100, 100);
            fill(0, 0, 100, 40); // 稍微提亮了一点点防止完全看不见
            textAlign(CENTER);
            textSize(12);
            text("Long press and drag down ➔ Take off your headphones", width / 2, height - 50);
            pop();
        }

        // 4. 处理下拉时的视觉崩坏 (Glitch)
        if (isDragging) {
            applyDragGlitch();
        }
}

// --- 带“撕裂与冲破”音效的崩坏过渡 ---
function drawGlitchTransition() {
  // --- 🎧 核心新增：纯代码合成的崩坏音效 ---
  // 只有在崩坏的第一帧触发沉重的“撕裂”与“坠落”主音效
  if (glitchTimer === 0) {
    // 1. "冲破/断电" 的沉重失重音 (Power Down)
    let dropOsc = new p5.Oscillator('sawtooth');
    dropOsc.freq(400); 
    dropOsc.freq(10, 0.5); // 核心魔法：0.5秒内频率暴跌，制造强烈的坠落感
    dropOsc.amp(0.6, 0.01); // 瞬间爆音
    dropOsc.amp(0, 0.5);   // 0.5秒后衰减到无
    dropOsc.start();
    dropOsc.stop(0.6);     // 释放内存

    // 2. "撕裂" 的粗糙白噪声 (Tearing Noise)
    let tearNoise = new p5.Noise('white');
    tearNoise.amp(0.5, 0.01);
    tearNoise.amp(0, 0.4); // 像纸被撕开一样短促
    tearNoise.start();
    tearNoise.stop(0.5);
  }

  // --- 👁️ 视觉与细碎电流声同步 ---
  // 1. 频闪与底噪 
  if (frameCount % 4 === 0) {
    background(0, 0, random([0, 100])); // 极端的黑白闪烁
    
    // 🎧 每次视觉闪烁时，同步发出一声极短的刺耳方波（数字火花）
    let spark = new p5.Oscillator('square');
    spark.freq(random(200, 3000));
    spark.amp(random(0.1, 0.3), 0.01);
    spark.amp(0, 0.05); // 存活极短
    spark.start();
    spark.stop(0.06);
  } else {
    background(10, 10, 15, 60); // 带残影的暗黑色
  }

  let duration = 40; 
  let intensity = map(glitchTimer, 0, duration, 0.2, 1.5); 

  // 2. 画面强行错位撕裂
  noStroke();
  for (let i = 0; i < 15 * intensity; i++) {
    if (random() < 0.5) fill(random(360), 100, 100, 80);
    else fill(0, 0, random([0, 100]), 90);

    let y = random(height);
    let h = random(2, 30) * intensity;
    rect(random(-100, width), y, random(width * 1.5), h);
  }

  // 3. RGB 色彩通道分离闪烁
  if (random() < 0.5) {
    drawingContext.globalCompositeOperation = 'screen';
    let offset = random(10, 50) * intensity; 
    let w = random(100, width);
    let h = random(50, 200);
    let cx = random(width);
    let cy = random(height);

    fill(0, 100, 100, 80); // R
    rect(cx - offset, cy, w, h);
    fill(120, 100, 100, 80); // G
    rect(cx, cy + offset, w, h);
    fill(240, 100, 100, 80); // B
    rect(cx + offset, cy - offset, w, h);
    
    drawingContext.globalCompositeOperation = 'source-over';
  }

  glitchTimer++;
  if (glitchTimer > duration) {
    state = 2; 
    glitchTimer = 0; 
  }
}
// --- 状态2：现实映射 (完美整合所有确认视觉) ---
function drawRealityMirror() {
  background(260, 60, 10, 10); // HSB: 260(偏蓝紫), 60(中饱和), 10(极低亮度), 10(残影透明度)

  fft.analyze(); 
  let bassEnergy = fft.getEnergy("bass");
  let midEnergy = fft.getEnergy("mid");
  let trebleEnergy = fft.getEnergy("treble");
  let vol = mic.getLevel();

  // ================= 沉默神经监测系统 (动态自适应版) =================
  let soundEnergy = bassEnergy + midEnergy + trebleEnergy;

  // 🛠️ 1. 动态底噪追踪引擎 (EMA 平滑算法)
  if (soundEnergy < ambientNoise) {
    ambientNoise = lerp(ambientNoise, soundEnergy, 0.1); 
  } else {
    ambientNoise = lerp(ambientNoise, soundEnergy, 0.002);
  }

  // 🛠️ 2. 提取“有效能量”
  let effectiveEnergy = max(0, soundEnergy - ambientNoise);

  // 🛠️ 3. 增强版探测器 (参展时建议隐藏这些调试数据，我已将其注释)
  /*
  fill(255, 100); noStroke(); textAlign(LEFT); textSize(14);
  text("环境底噪 (Ambient): " + floor(ambientNoise), 20, 30);
  text("有效能量 (Effective): " + floor(effectiveEnergy), 20, 50);
  */

  // 🛠️ 4. 全新相对判定
  let triggerThreshold = 40; 

  if (effectiveEnergy < triggerThreshold) {
    silenceTimer++;
    // 安静超过 1.5 秒，强制抹除卡在中间的幽灵字幕
    if (silenceTimer > 90) {
      liveTextDisplay = ""; 
    }
  } else {
    // 只要有效能量突破阈值，立刻击碎！
    if (silenceTimer > 300 && !isCoralShattered) {
      triggerCoralShatter();
      background(45, 5, 95); // 暴力清屏
    }
    silenceTimer = 0; 
  }

  if (silenceTimer > 300) {
    drawCoralFractal(silenceTimer);
  }

  for (let i = coralParticles.length - 1; i >= 0; i--) {
    coralParticles[i].update();
    coralParticles[i].display();
    if (coralParticles[i].isDead()) coralParticles.splice(i, 1);
  }
  if (coralParticles.length === 0) isCoralShattered = false;
  // ==========================================================

  // ================= 频率自适应引擎 (Leaky Peak) =================
  peakBass = max(40, peakBass - 0.2); 
  peakMid = max(40, peakMid - 0.2);
  peakTreble = max(40, peakTreble - 0.2);

  if (bassEnergy > peakBass) peakBass = bassEnergy;
  if (midEnergy > peakMid) peakMid = midEnergy;
  if (trebleEnergy > peakTreble) peakTreble = trebleEnergy;

  let ratioBass = bassEnergy / peakBass;
  let ratioMid = midEnergy / peakMid;
  let ratioTreble = trebleEnergy / peakTreble;
  // ==========================================================

  // 1. 低频波纹
  if (ratioBass > 0.85 && bassEnergy > 30) {
    bassWaves.push(new BassWave(random(width), random(height), bassEnergy));
  }
  for (let i = bassWaves.length - 1; i >= 0; i--) {
    bassWaves[i].update(); bassWaves[i].display();
    if (bassWaves[i].isDead()) bassWaves.splice(i, 1);
  }

  // 2. 中频笔触
  if (ratioMid > 0.75 && midEnergy > 30) {
    midStrokes.push(new MielgoStroke(random(width), random(height), midEnergy));
  }
  for (let i = midStrokes.length - 1; i >= 0; i--) {
    midStrokes[i].update(); midStrokes[i].display();
    if (midStrokes[i].isDead()) midStrokes.splice(i, 1);
  }

  // 3. 高频碎星
  if (ratioTreble > 0.8 && trebleEnergy > 30) {
    trebleSparks.push(new TrebleSpark(random(width), random(height)));
  }
  for (let i = trebleSparks.length - 1; i >= 0; i--) {
    trebleSparks[i].update(); trebleSparks[i].display();
    if (trebleSparks[i].isDead()) trebleSparks.splice(i, 1);
  }

  // 4. 左下角孤独漫步者
  drawWalkingPerson(vol);

  // 5. 悬浮的幽灵字幕 (独立极速消散版)
  if (liveTextDisplay !== "" && subtitleAlpha > 0) {
    fill(0, 0, 100, subtitleAlpha); 
    noStroke(); textAlign(CENTER); textSize(48); textStyle(BOLD);
    text(liveTextDisplay, width / 2, height / 2);
    
    // 【核心修复 2：极速消散】
    subtitleAlpha -= 15; 
  } else {
    // 一旦透明度掉光，彻底清空文字，绝对不留残影
    liveTextDisplay = ""; 
  }

  // 6. 语义掉落文字
  for (let i = fallingWords.length - 1; i >= 0; i--) {
    fallingWords[i].update(); fallingWords[i].display();
    if (fallingWords[i].isDead()) fallingWords.splice(i, 1);
  }

  // 7. 语义几何图形
  for (let i = semanticParticles.length - 1; i >= 0; i--) {
    semanticParticles[i].update(); semanticParticles[i].display();
    if (semanticParticles[i].isDead()) semanticParticles.splice(i, 1);
  }

  // 8. 错误提示兜底
  if (speechError !== "") {
    fill(0, 80, 80, 80); noStroke(); textAlign(CENTER); textSize(16);
    text(speechError, width / 2, 80);
  }
}

// 左下角，按音量改变速度的孤独小人
function drawWalkingPerson(vol) {
  push();
  translate(width * 0.2, height - 120);
  scale(0.6); 
  let walkSpeed = frameCount * (0.02 + vol * 0.1);
  let bob = sin(walkSpeed * 2) * 10; 
  
  stroke(0, 0, 100, 40); 
  strokeWeight(3); 
  noFill();
  
  ellipse(0, -120 + bob, 30, 35); 
  line(0, -85 + bob, 0, -20 + bob); 
  let leftLeg = sin(walkSpeed) * 30;
  let rightLeg = cos(walkSpeed) * 30;
  line(0, -20 + bob, leftLeg, 30);
  line(0, -20 + bob, rightLeg, 30);
  pop();
}

// ================= 交互事件监听 =================

// --- 1. 按下鼠标 ---
function mousePressed() {
    // 【开场拦截】：如果没有激活，只负责解锁音频和亮出二维码
    if (state === -1 && !isAudioActivated) {
        userStartAudio(); 
        isAudioActivated = true; 
        return; // 点完就退出，不执行后面的逻辑
    }

    // 【漫步交互】：如果是 state 0，按下鼠标开始记录拖拽起点
    if (state === 0) {
        isDragging = true;
        dragStartY = mouseY;
    }
}

// --- 2. 拖拽鼠标 ---
function mouseDragged() {
    // 只有在 state 0 且按下鼠标时才计算向下的拉力
    if (isDragging && state === 0) {
        // 只记录向下的位移
        dragOffset = max(0, mouseY - dragStartY);
    }
}

// --- 3. 松开鼠标 (决定是否成功摘下耳机) ---
function mouseReleased() {
    if (isDragging && state === 0) {
        // 判定是否达到了“摘下”的阈值
        if (dragOffset > dragThreshold) {
            console.log("成功脱离！进入摘耳机状态 1");
            
            // 成功脱离：停掉背景音乐（替换了原来的 mySong）
            if (currentAudio && currentAudio.isPlaying()) {
                currentAudio.stop();
            }
            
            // 启动麦克风和语音识别
            mic.start();
            fft.setInput(mic);
            if (typeof speechRec !== 'undefined') {
                try { speechRec.start(); } catch(e) { console.warn("语音识别启动失败", e); }
            }
            
            // 切换到崩坏过渡状态
            state = 1; 
        }
        
        // 无论成功与否，松开鼠标就重置拖拽状态
        isDragging = false;
        dragOffset = 0;
    }
}

// ================= 视觉类定义 =================

class BassWave {
  constructor(x, y, energy) {
    this.x = x; 
    this.y = y; 
    this.r = 20; 
    this.alpha = 80;
  }
  update() { 
    this.r += 6; 
    this.alpha -= 1.5; 
  }
  display() {
    noFill(); 
    stroke(220, 80, 40, this.alpha); 
    strokeWeight(15); 
    ellipse(this.x, this.y, this.r);
  }
  isDead() { 
    return this.alpha <= 0; 
  }
}

class MielgoStroke {
  constructor(x, y, energy) {
    this.pos = createVector(x, y); 
    this.vel = p5.Vector.random2D().mult(energy / 30);
    this.lifespan = 255; 
    this.c = color(random(10, 45), random(70, 100), 100, 80); 
    this.w = random(20, 60); 
    this.h = random(60, 150); 
    this.angle = random(TWO_PI);
  }
  update() { 
    this.lifespan -= 6; 
    this.pos.add(this.vel); 
  }
  display() {
    noStroke(); 
    fill(hue(this.c), saturation(this.c), brightness(this.c), this.lifespan / 2);
    push(); 
    translate(this.pos.x, this.pos.y); 
    rotate(this.angle); 
    rectMode(CENTER);
    rect(0, 0, this.w, this.h, 5); 
    pop();
  }
  isDead() { 
    return this.lifespan < 0; 
  }
}

class TrebleSpark {
  constructor(x, y) {
    this.pos = createVector(x, y); 
    this.vel = p5.Vector.random2D().mult(random(10, 25)); 
    this.lifespan = 255; 
    this.length = random(10, 40); 
    this.angle = this.vel.heading();
    let h = random(1) > 0.5 ? random(170, 190) : random(310, 330);
    this.c = color(h, 100, 80, this.lifespan / 1.5); 
  }
  update() { 
    this.pos.add(this.vel); 
    this.lifespan -= 25; 
  }
  display() {
    stroke(hue(this.c), saturation(this.c), brightness(this.c), this.lifespan / 1.5);
    strokeWeight(random(2, 5)); 
    push(); 
    translate(this.pos.x, this.pos.y); 
    rotate(this.angle); 
    line(0, 0, this.length, 0); 
    pop();
  }
  isDead() { 
    return this.lifespan < 0; 
  }
}

class FallingWord {
  constructor(txt, x, delay) {
    this.txt = txt; 
    this.pos = createVector(x, -50 - delay);
    this.vel = createVector(0, random(4, 8)); 
    this.alpha = 255; 
    this.size = random(16, 28);
  }
  update() {
    this.pos.add(this.vel);
    if (this.pos.y > height * 0.7) { 
      this.vel.mult(0.9); 
      this.alpha -= 8; 
    }
  }
  display() {
    fill(0, 0, 100, this.alpha * 0.2); 
    noStroke(); 
    textAlign(CENTER, CENTER); 
    textSize(this.size); 
    text(this.txt, this.pos.x, this.pos.y);
  }
  isDead() { 
    return this.alpha <= 0; 
  }
}

class SemanticShape {
  constructor(char, x, y) {
    this.pos = createVector(x, y); 
    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.alpha = 200; 
    this.rotation = random(TWO_PI); 
    this.rotSpeed = random(-0.05, 0.05);
    this.size = random(20, 60); 
    this.type = 'polygon'; 
    this.sides = (char.charCodeAt(0) % 5) + 3; 
    this.c = color((char.charCodeAt(0) % 360), 80, 80, this.alpha); 

    let waterWords = ["雨", "水", "海", "泪", "流", "冰", "雪"];
    let fireWords = ["火", "热", "光", "日", "阳", "燃", "焰"];
    let starWords = ["星", "夜", "空", "闪", "亮"];
    let heartWords = ["心", "爱", "情", "思", "念"];

    if (waterWords.includes(char)) { 
      this.type = 'water'; 
      this.c = color(200, 90, 90, this.alpha); 
      this.vel = createVector(0, random(3, 6)); 
    } 
    else if (fireWords.includes(char)) { 
      this.type = 'fire'; 
      this.c = color(random(10, 30), 100, 90, this.alpha); 
      this.vel = createVector(0, random(-2, -5)); 
    } 
    else if (starWords.includes(char)) { 
      this.type = 'star'; 
      this.c = color(60, 20, 100, this.alpha); 
      this.rotSpeed = random(0.1, 0.2); 
    } 
    else if (heartWords.includes(char)) { 
      this.type = 'heart'; 
      this.c = color(340, 80, 90, this.alpha); 
      this.vel.mult(0.5); 
    }
  }
  update() {
    this.pos.add(this.vel); 
    this.rotation += this.rotSpeed; 
    this.alpha -= 2; 
    this.c.setAlpha(this.alpha);
  }
  display() {
    push(); 
    translate(this.pos.x, this.pos.y); 
    rotate(this.rotation);
    noFill(); 
    stroke(this.c); 
    strokeWeight(2); 
    drawingContext.shadowBlur = 15; 
    drawingContext.shadowColor = this.c.toString();
    
    if (this.type === 'water') { 
      ellipse(0, 0, this.size * 0.8, this.size); 
    } 
    else if (this.type === 'fire') { 
      triangle(-this.size/2, this.size/2, this.size/2, this.size/2, 0, -this.size); 
    } 
    else if (this.type === 'star') { 
      line(-this.size, 0, this.size, 0); 
      line(0, -this.size, 0, this.size); 
    } 
    else if (this.type === 'heart') { 
      strokeWeight(4); 
      let pulse = 1 + sin(frameCount * 0.2) * 0.3; 
      ellipse(0, 0, this.size * pulse); 
    } 
    else {
      beginShape();
      for (let a = 0; a < TWO_PI; a += TWO_PI / this.sides) { 
        vertex(cos(a) * this.size, sin(a) * this.size); 
      }
      endShape(CLOSE);
    }
    pop();
  }
  isDead() { 
    return this.alpha <= 0; 
  }
}

// ================= 沉默珊瑚生长模块 (高帧率优化版) =================

function drawCoralFractal(timer) {
  push();
  translate(width / 2, height * 0.6); 
  
  // 性能锁：最大层数严苛限制在 6 层！(层数越少，性能越高)
  let maxDepth = floor(map(min(timer, 600), 300, 600, 1, 6));
  let alpha = map(timer, 300, 500, 0, 150, true);

  stroke(190, 30, 100, alpha); 
  
  // 彻底移除了极耗性能的 shadowBlur 和 setLineDash
  branch(0, 0, -PI / 2, 80, 0, maxDepth);
  branch(0, 0, -PI / 2 - 0.4, 60, 0, maxDepth);
  branch(0, 0, -PI / 2 + 0.4, 60, 0, maxDepth);
  pop();
}

function branch(x, y, angle, len, depth, maxDepth) {
  if (depth >= maxDepth) return;

  let nx = x + cos(angle) * len;
  let ny = y + sin(angle) * len;

  strokeWeight(map(depth, 0, maxDepth, 2, 0.3));
  line(x, y, nx, ny);

  // 视觉替代方案：在每一个关节处画一个微小的光点，模拟“粒子凝结感”
  noStroke();
  fill(190, 30, 100, 180);
  ellipse(nx, ny, 2, 2);
  stroke(190, 30, 100, 150); // 恢复描边颜色供下一层使用

  let angleOffset = noise(depth, frameCount * 0.002) * 0.5 + 0.1;
  // 长度递减加一点随机性，让它长得更像生物
  let newLen = len * random(0.7, 0.85); 

  branch(nx, ny, angle - angleOffset, newLen, depth + 1, maxDepth);
  branch(nx, ny, angle + angleOffset, newLen, depth + 1, maxDepth);
}

// ================= 碎裂动作与粒子类 =================

// 触发碎裂动作函数 (全屏加强版)
function triggerCoralShatter() {
  isCoralShattered = true;
  // 粒子数量翻倍到 800，确保能撑满整个屏幕的细节
  for (let i = 0; i < 800; i++) {
    coralParticles.push(new ShatterParticle(width / 2, height * 0.6));
  }
}

// 碎裂逃逸粒子类 (全屏暴散加强版)
class ShatterParticle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    
    // 1. 狂暴初速度：把上限拉高到 50，让它们能瞬间射到屏幕边缘！
    let speed = random() < 0.2 ? random(30, 60) : random(10, 35);
    this.vel = p5.Vector.random2D().mult(speed);
    
    this.alpha = 255;
    this.size = random(1.5, 5); 
    this.decayRate = random(3, 7); 
  }
  
  update() {
    this.pos.add(this.vel);
    
    // 2. 降低空气阻力：从 0.9 改为 0.96，让粒子滑行距离更远
    this.vel.mult(0.96); 
    
    // 3. 减缓消散速度
    this.alpha -= this.decayRate;    
  }
  
  display() {
    noStroke();
    // 刺眼高亮白/冰蓝色
    fill(200, 10, 100, this.alpha);
    ellipse(this.pos.x, this.pos.y, this.size);
  }
  
  isDead() { return this.alpha <= 0; }
}

function applyDragGlitch() {
  // 计算崩坏强度 (0.0 - 1.0)
  let intensity = map(dragOffset, 0, dragThreshold, 0, 1, true);
  
  // 1. 随机错位 (取部分像素块进行偏移)
  if (random() < intensity) {
    let x = random(width);
    let y = random(height);
    let w = random(100, 300);
    let h = random(20, 50);
    copy(x, y, w, h, x + random(-20, 20) * intensity, y, w, h);
  }

  // 2. 颜色闪烁
  if (random() < intensity * 0.5) {
    fill(0, 100, 100, 20 * intensity); // 红色闪烁
    rect(0, 0, width, height);
  }

  // 3. 绘制一个提示拉动进度的视觉反馈
  stroke(0, 0, 100, 50);
  line(width / 2 - 20, dragStartY, width / 2 + 20, dragStartY);
  line(width / 2, dragStartY, width / 2, dragStartY + dragOffset);
  ellipse(width / 2, dragStartY + dragOffset, 10, 10);
}

// ================= 开场/隔离状态专用：带耳机的替身 =================

function drawIsolatedAvatar(vol, scaleFactor, hpOffset = 0) {
  push();
  scale(scaleFactor);
  
  let walkSpeed = frameCount * (0.02 + vol * 0.1);
  let bob = sin(walkSpeed * 2) * 5;

  stroke(0, 0, 100, 80); 
  strokeWeight(2 / scaleFactor); 
  noFill();

  // 1. 头部
  ellipse(0, -60 + bob, 20, 20);
  
  // 🎧 2. 核心隐喻：隔离耳机 (通过 hpOffset 控制悬空)
  push();
  translate(0, -hpOffset); // 向上平移耳机
  stroke(200, 80, 100); 
  strokeWeight(3 / scaleFactor);
  arc(0, -60 + bob, 26, 26, PI, TWO_PI); 
  fill(200, 80, 100, 60);
  noStroke();
  ellipse(-13, -60 + bob, 6, 10); 
  ellipse(13, -60 + bob, 6, 10);  
  pop();

  // 3. 躯干与四肢
  line(0, -50 + bob, 0, -20 + bob); 
  let leftLeg = sin(walkSpeed) * 15;
  let rightLeg = cos(walkSpeed) * 15;
  line(0, -20 + bob, leftLeg, 10); 
  line(0, -20 + bob, rightLeg, 10);
  line(0, -40 + bob, -leftLeg * 0.8, -15);
  line(0, -40 + bob, -rightLeg * 0.8, -15);
  
  pop();
}
// 准备一个变量，用来装当前正在放的歌
let currentPlayingAudio; 

// 这是刚才在 setup() 里让你加的监听器
// 确保它长这样：
  db.ref('currentMood').on('value', (snapshot) => {
      const mood = snapshot.val();
      if (mood) {
          console.log("监听到模式切换:", mood);
          switchChannel(mood); // 拿到信号，执行切频道函数
      }
  });

// 🔥 核心切歌逻辑
// ✅ 修复版：带有“强制拦截”的换台函数
function switchChannel(mood) {
    // 🔒 铁闸门：如果观众还没点过电脑屏幕，直接丢弃信号，绝对不准往下走！
    if (!isAudioActivated) {
        console.warn("拦截：电脑端尚未点击激活，忽略本次指令 (" + mood + ")");
        return; // 这里的 return 极其重要，它能强行中断函数，防止 state 变成 0
    }

    // --- 下面是正常的切歌逻辑 ---
    // 1. 停掉旧歌
    if (currentAudio && currentAudio.isPlaying()) {
        currentAudio.stop();
    }

    // 2. 加载新歌
    let audioPath = `${mood}.mp3`;
    console.log("云端指令通过，开始播放:", audioPath);

    currentAudio = loadSound(audioPath, () => {
        currentAudio.play();
        currentAudio.loop();
        
        // 3. 只有音乐真正响起来了，才允许画面切到小人走路
        state = 0; 
        console.log("✅ 画面已切换至漫步模式 (state=0)");
    }, (err) => {
        console.error("❌ 音频加载失败:", err);
    });
}
