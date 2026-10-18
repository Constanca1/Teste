// ---------- Instruments ----------
// [x%, y%, width%, height%, palette, name, sound param]
const PAL=[["#ffe45e","#ff7ab0","#2a3bb5"],["#ffd2d8","#8fd0ff","#3a8fe0"],["#2bb5ff","#4a1170","#1d0a3a"],["#8fe3ff","#ff2f9a","#ffd6e8"],
["#ff9a3c","#ff5a7a","#4fb8ff"],["#6a2fd0","#2a1a80","#7fd4ff"],["#ffd23c","#e0188a","#12041f"],["#ffcf40","#ff3a5a","#ffb020"],
["#3ccf91","#2a1f80","#c9f2c0"],["#00b8d9","#2a1a80","#6ae0a0"],["#ff1f9e","#8c0a6a","#7fd4ff"],["#d0e84a","#e0107e","#6a0a50"]];
const I={
 Drums:{balls:[[9,50,17,17,3,"Hi-hat","hat"],[22,18,19,19,7,"Crash","crash"],[40,36,15,15,0,"Tom 1","t1"],[60,36,15,15,6,"Tom 2","t2"],[74,68,17,17,8,"Floor tom","t3"],[91,48,18,18,10,"Ride","ride"],[50,84,19,19,2,"Kick","kick"],[26,68,15,15,9,"Snare","snare"]]},
 Piano:{balls:[...Array(8)].map((_,i)=>[8+i*12,50,11,58,[10,6,4,8,11,3,0,9][i],"Note "+"C D E F G A B C".split(" ")[i],[261.6,293.7,329.6,349.2,392,440,493.9,523.3][i]])},
 Accordion:{balls:[[50,50,26,36,0,"Bellows","bellows"]]}
};
const names=Object.keys(I);let cur=0;
Object.entries(I).forEach(([k,o])=>k!=="Accordion"&&o.balls.forEach(b=>{b[2]*=.85;b[3]*=.85}));

// ---------- Audio ----------
const AC=new (window.AudioContext||window.webkitAudioContext)({latencyHint:"interactive"});
const master=AC.createGain();master.gain.value=.8;master.connect(AC.destination);
const musicDest=AC.createMediaStreamDestination();master.connect(musicDest);
const noiseBuf=(()=>{const b=AC.createBuffer(1,AC.sampleRate,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b})();
let pitch=1;const raw={},custom={}; // "Instrument:index" -> recorded sound
function env(g,t,a,d,p=1){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(p,t+a);g.gain.exponentialRampToValueAtTime(.001,t+d)}
function noise(f,type,d,vol=.6){const t=AC.currentTime,s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noiseBuf;fl.type=type;fl.frequency.value=f;env(g,t,.002,d,vol);s.connect(fl).connect(g).connect(master);s.start(t);s.stop(t+d)}
function sweep(f0,f1,d,vol=.9){const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(f0*pitch,t);o.frequency.exponentialRampToValueAtTime(f1*pitch,t+d);env(g,t,.002,d,vol);o.connect(g).connect(master);o.start(t);o.stop(t+d)}
function tone(f,type,d,vol=.5){const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f*pitch;env(g,t,.005,d,vol);o.connect(g).connect(master);o.start(t);o.stop(t+d)}
const drum={kick:()=>sweep(150,40,.35),snare:()=>{noise(1800,"bandpass",.2);sweep(220,120,.12,.5)},hat:()=>noise(7000,"highpass",.07,.4),
 t1:()=>sweep(260,120,.3),t2:()=>sweep(200,90,.35),t3:()=>sweep(140,60,.45),crash:()=>noise(5000,"highpass",1.2,.5),ride:()=>{noise(6500,"highpass",.6,.35);tone(1200,"triangle",.4,.2)}};
function playBuf(b){const s=AC.createBufferSource();s.buffer=b;s.playbackRate.value=pitch;s.connect(master);s.start()}

function trigger(inst,i,replay){
  AC.resume();const b=I[inst].balls[i],key=inst+":"+i;
  if(!replay&&recOn)events.push([performance.now()-recT0,inst,i]);
  flash(inst,i);
  if(custom[key]){playBuf(custom[key]);return}
  if(inst==="Drums")drum[b[6]]();
  else{tone(b[6],"sine",1.4);tone(b[6]*2,"sine",.6,.2)}
}

// Accordion: a chord that sounds while the bellows moves
const CH=[[261.6,329.6,392],[349.2,440,523.3],[392,493.9,587.3],[220,261.6,329.6]]; // C F G Am
let acc=null;
function accStart(){
  if(acc)return;const g=AC.createGain(),f=AC.createBiquadFilter();f.type="lowpass";f.frequency.value=1400;g.gain.value=0;f.connect(g).connect(master);
  acc={g,os:CH[0].map(fr=>{const o=AC.createOscillator();o.type="sawtooth";o.frequency.value=fr*pitch;o.connect(f);o.start();return o})};
}
function accStop(){if(!acc)return;const a=acc;acc=null;a.g.gain.setTargetAtTime(0,AC.currentTime,.05);a.os.forEach(o=>o.stop(AC.currentTime+.4))}
function accSet(vol,chord){if(!acc)return;acc.g.gain.setTargetAtTime(vol,AC.currentTime,.04);acc.os.forEach((o,i)=>o.frequency.setTargetAtTime(CH[chord][i]*pitch,AC.currentTime,.03))}

// ---------- Interface ----------
const stage=document.getElementById("stage"),ballEls=[];
function setMsg(t){document.getElementById("msg").textContent=t}
function flash(inst,i){if(inst!==names[cur])return;const el=ballEls[i];if(!el)return;el.classList.add("hit");setTimeout(()=>el.classList.remove("hit"),180)}
function grad(p){return `radial-gradient(circle at 62% 38%, ${p[0]} 0%, ${p[1]} 38%, ${p[2]} 62%, rgba(255,255,255,0) 72%)`}
function render(){
  stopPlay();setMsg("");document.getElementById("title").textContent=names[cur];
  ballEls.forEach(e=>e.remove());ballEls.length=0;
  I[names[cur]].balls.forEach((b,i)=>{
    const el=document.createElement("div"),p=PAL[b[4]];el.className="ball";
    Object.assign(el.style,{left:b[0]+"%",top:b[1]+"%",width:b[2]+"%",height:b[3]+"%",background:grad(p)});
    el.style.setProperty("--glow",p[1]);el.setAttribute("aria-label",b[5]);
    el.onpointerdown=()=>{if(b[6]!=="bellows")trigger(names[cur],i)};
    stage.appendChild(el);ballEls.push(el);
  });
  const rows=document.getElementById("rows");rows.innerHTML="";
  I[names[cur]].balls.forEach((b,i)=>{
    if(b[6]==="bellows")return;
    const key=names[cur]+":"+i,r=document.createElement("div");r.className="row";
    r.innerHTML=`<span class="dot" style="background:${PAL[b[4]][1]}"></span><b>${b[5]}</b><small>${custom[key]?"your sound":"default sound"}</small>`;
    const rec=document.createElement("button");rec.className="mini";rec.textContent="Record sound";rec.onclick=()=>recordBall(key,rec,r.querySelector("small"));
    const rs=document.createElement("button");rs.className="mini";rs.textContent="Reset";rs.onclick=()=>{delete custom[key];delete raw[key];r.querySelector("small").textContent="default sound"};
    r.append(rec,rs);rows.appendChild(r);
  });
}
async function recordBall(key,btn,label){
  try{
    const st=await navigator.mediaDevices.getUserMedia({audio:true}),mr=new MediaRecorder(st),ch=[];
    mr.ondataavailable=e=>ch.push(e.data);btn.textContent="Recording…";
    mr.onstop=async()=>{st.getTracks().forEach(t=>t.stop());const blob=new Blob(ch);raw[key]=blob;custom[key]=await AC.decodeAudioData(await blob.arrayBuffer());label.textContent="your sound";btn.textContent="Record sound";playBuf(custom[key])};
    mr.start();setTimeout(()=>mr.stop(),1500);
  }catch(e){btn.textContent="Record sound";setMsg("Couldn't access the microphone.")}
}
document.getElementById("prev").onclick=()=>{cur=(cur+names.length-1)%names.length;render()};
document.getElementById("next").onclick=()=>{cur=(cur+1)%names.length;render()};
document.getElementById("vol").oninput=e=>master.gain.value=+e.target.value;

// ---------- Record music (audio + notes) ----------
let recOn=false,recT0=0,events=[],mr2,chunks2=[];
const mbtn=document.getElementById("musicRec"),mout=document.getElementById("musicOut");
mbtn.onclick=()=>{
  AC.resume();
  if(!recOn){recOn=true;events=[];recT0=performance.now();chunks2=[];mr2=new MediaRecorder(musicDest.stream);mr2.ondataavailable=e=>chunks2.push(e.data);mr2.start();mbtn.classList.add("on");mbtn.textContent="Stop recording";mout.innerHTML=""}
  else{recOn=false;mr2.onstop=()=>{const url=URL.createObjectURL(new Blob(chunks2)),saved=events.slice();
    mout.innerHTML=`<button class="btn" id="rp">Play back notes</button><a class="btn" download="my-music.webm" href="${url}">Download audio</a>`;
    document.getElementById("rp").onclick=()=>saved.forEach(([t,ins,i])=>setTimeout(()=>trigger(ins,i,true),t))};
    mr2.stop();mbtn.classList.remove("on");mbtn.textContent="Record music"}
};

// ---------- Camera and hands ----------
const video=document.getElementById("video"),cv=document.getElementById("hands"),cx=cv.getContext("2d");
const help=document.getElementById("help"),startBtn=document.getElementById("start");
const TIPS=[4,8,12,16,20],next=f=>video.requestVideoFrameCallback?video.requestVideoFrameCallback(f):requestAnimationFrame(f);
let landmarker,playing=false,stream,prevHit={},prevPt={},lastVT=-1,bellN=.4;
startBtn.onclick=()=>{AC.resume();playing?stopPlay():help.showModal()};
document.getElementById("cancel").onclick=()=>help.close();
document.getElementById("go").onclick=async()=>{help.close();await startPlay()};

async function startPlay(){
  AC.resume();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setMsg("Camera blocked: open this page via https:// (GitHub Pages) or http://localhost, not by double-clicking the file.");return}
  try{
    setMsg("Requesting camera access…");
    stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,frameRate:60},audio:false});
    video.srcObject=stream;await video.play();video.style.display="block";
  }catch(e){stopPlay();setMsg(e.name==="NotAllowedError"?"Camera permission denied. Allow it in your browser's site settings and try again.":"Couldn't open the camera ("+e.name+").");return}
  try{
    if(!landmarker){setMsg("Loading hand tracking…");
      const {HandLandmarker,FilesetResolver}=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm");
      const fs=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
      const mk=d=>HandLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",delegate:d},runningMode:"VIDEO",numHands:2});
      try{landmarker=await mk("GPU")}catch(e){landmarker=await mk("CPU")}}
  }catch(e){stopPlay();setMsg("Couldn't load hand tracking (internet needed).");return}
  playing=true;document.body.classList.add("live");startBtn.textContent="Stop";
  if(names[cur]==="Accordion")accStart();
  tick();
}
function stopPlay(){
  playing=false;document.body.classList.remove("live");startBtn.textContent="Start playing";video.style.display="none";
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;prevHit={};prevPt={};cx.clearRect(0,0,cv.width,cv.height);accStop();
}
function tick(){if(!playing)return;process();next(tick)}
function process(){
  if(video.currentTime===lastVT)return;lastVT=video.currentTime;
  const W=stage.clientWidth,H=stage.clientHeight;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  cx.clearRect(0,0,W,H);
  const hands=landmarker.detectForVideo(video,performance.now()).landmarks,inst=names[cur],balls=I[inst].balls,hit={},pts={};
  setMsg(hands.length===2?(inst==="Accordion"?"Pull your hands apart and push them together. Raise or lower them to change the chord.":""):hands.length?"Show your other hand too.":"Show both hands to the camera.");
  hands.forEach((hand,h)=>TIPS.forEach(t=>{
    const x=(1-hand[t].x)*100,y=hand[t].y*100,id=h+"-"+t;let p=prevPt[id]||[x,y];
    if(Math.hypot(x-p[0],y-p[1])>25)p=[x,y];pts[id]=[x,y];
    cx.fillStyle="rgba(17,17,17,.8)";cx.beginPath();cx.arc(x*W/100,y*H/100,6,0,7);cx.fill();
    if(inst==="Accordion")return;
    for(let s=1;s<=5;s++){const px=p[0]+(x-p[0])*s/5,py=p[1]+(y-p[1])*s/5;
      balls.forEach((b,i)=>{const dx=(px-b[0])/(b[2]/2*1.15),dy=(py-b[1])/(b[3]/2*1.15);if(dx*dx+dy*dy<1)hit[i]=1})}
  }));
  if(inst==="Accordion"){
    let v=0,chord=0;
    if(hands.length===2){
      const a=hands[0][9],b=hands[1][9],n=Math.min(1,Math.max(0,(Math.abs(a.x-b.x)-.15)/.5)),my=(a.y+b.y)/2;
      v=Math.min(.3,Math.abs(n-bellN)*8);bellN+=(n-bellN)*.35;
      chord=Math.min(3,Math.max(0,Math.floor((my-.25)/.12)));
      ballEls[0].style.width=(10+bellN*80)+"%";ballEls[0].style.top=my*100+"%";
    }
    accSet(v,chord);prevPt=pts;return;
  }
  balls.forEach((_,i)=>{if(hit[i]&&!prevHit[i])trigger(inst,i)});
  prevHit=hit;prevPt=pts;
}

// ---------- Settings panel: close on outside tap + save ----------
const gear=document.getElementById("gear"),panel=document.getElementById("panel"),volEl=document.getElementById("vol"),pitEl=document.getElementById("pit");
const closePanel=()=>{panel.hidden=true;gear.setAttribute("aria-expanded","false")};
pitEl.oninput=e=>pitch=2**(+e.target.value);
gear.onclick=()=>{panel.hidden=!panel.hidden;gear.setAttribute("aria-expanded",!panel.hidden)};
document.addEventListener("pointerdown",e=>{if(!panel.hidden&&!panel.contains(e.target)&&!gear.contains(e.target))closePanel()});
const SK="soundballs_v1",toUrl=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
document.getElementById("save").onclick=async()=>{
  try{const sounds={};for(const k in custom)sounds[k]=await toUrl(raw[k]);
    localStorage.setItem(SK,JSON.stringify({vol:volEl.value,pit:pitEl.value,sounds}));setMsg("Changes saved.")}
  catch(e){setMsg("Couldn't save your changes (browser storage full or blocked).")}
  closePanel();
};
async function load(){
  try{const d=JSON.parse(localStorage.getItem(SK)||"{}");
    if(d.vol!=null){volEl.value=d.vol;master.gain.value=+d.vol}
    if(d.pit!=null){pitEl.value=d.pit;pitch=2**d.pit}
    for(const k in d.sounds||{}){const b=await(await fetch(d.sounds[k])).blob();raw[k]=b;custom[k]=await AC.decodeAudioData(await b.arrayBuffer())}}
  catch(e){}
  render();
}
render();load();
