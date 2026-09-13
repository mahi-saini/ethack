'use client';
import {useEffect,useRef,useState} from 'react';
import {AgentReply} from '@/lib/agent-contract';
import {apiJson} from '@/lib/client-api';
import {voiceSession} from '@/lib/voice-session';
export function useVoice({ask,stopResearch}:{ask:(question:string,voice:boolean)=>Promise<AgentReply>;stopResearch:()=>void}){
 const [state,setState]=useState<'idle'|'connecting'|'active'>('idle'),[error,setError]=useState(''),[transcript,setTranscript]=useState(''),[researching,setResearching]=useState(false);
 const active=useRef<{pc:RTCPeerConnection|null;stream:MediaStream|null;audio:HTMLAudioElement|null;controller:AbortController|null;timer:ReturnType<typeof setTimeout>|null}>({pc:null,stream:null,audio:null,controller:null,timer:null});
 const epoch=useRef(0),pending=useRef(false),callbacks=useRef({ask,stopResearch});useEffect(()=>{callbacks.current={ask,stopResearch}},[ask,stopResearch]);
 function cleanup(){epoch.current++;const a=active.current;a.controller?.abort();a.pc?.close();a.stream?.getTracks().forEach(t=>t.stop());if(a.audio){a.audio.pause();a.audio.srcObject=null}if(a.timer)clearTimeout(a.timer);active.current={pc:null,stream:null,audio:null,controller:null,timer:null};if(pending.current)callbacks.current.stopResearch();pending.current=false}
 function stop(){cleanup();setState('idle');setResearching(false);setTranscript('')}
 useEffect(()=>()=>cleanup(),[]);
 async function start(){
  if(active.current.controller)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){setError('This browser does not support voice chat. Please use text or a recent browser.');return}
  setError('');setState('connecting');const token=++epoch.current,c=new AbortController();active.current.controller=c;
  const current=()=>epoch.current===token&&!c.signal.aborted;
  try{
   const cfg=await apiJson<{iceServers:RTCIceServer[]}>('/api/voice/config',{signal:c.signal});if(!current())return;
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});if(!current()){stream.getTracks().forEach(t=>t.stop());return}active.current.stream=stream;stream.getAudioTracks().forEach(t=>t.enabled=false);
   const pc=new RTCPeerConnection({iceServers:cfg.iceServers});active.current.pc=pc;
   const audio=new Audio();audio.autoplay=true;active.current.audio=audio;
   pc.ontrack=e=>{if(current()){audio.srcObject=new MediaStream([e.track]);audio.play().catch(()=>{if(current())setError('Your browser paused audio. Allow audio playback for HyperGreen and reconnect.');})}};
   stream.getTracks().forEach(t=>pc.addTrack(t,stream));
   const dc=pc.createDataChannel('oai-events',{ordered:true}),handled=new Set<string>();
   let configured=false;
   dc.onopen=()=>{if(current())dc.send(JSON.stringify({type:'session.update',session:voiceSession}))};
   dc.onmessage=async event=>{
    if(!current())return;let e:{type:string;transcript?:string;call_id?:string;arguments?:string;name?:string;session?:{tools?:{name?:string}[]}};try{e=JSON.parse(event.data)}catch{return}
    if(e.type==='session.updated'&&!configured){
     if(!e.session?.tools?.some(t=>t.name==='ask_hypergreen')){stop();setError('Voice research tools were not connected. Please reconnect or use text chat.');return}
     configured=true;stream.getAudioTracks().forEach(t=>t.enabled=true);setState('active');if(active.current.timer)clearTimeout(active.current.timer);active.current.timer=setTimeout(()=>{stop();setError('The five-minute voice session ended. Start a new session to continue.');},5*60*1000);
    }
    if(e.type==='conversation.item.input_audio_transcription.completed')setTranscript(e.transcript??'');
    if(e.type==='error'){setError('The voice provider reported a connection or model error. Please reconnect or use text chat.');stop();return}
    if(e.type==='response.function_call_arguments.done'&&e.call_id&&!handled.has(e.call_id)){
     handled.add(e.call_id);let output:unknown;
     if(pending.current)output={error:'Another research request is still running. Wait and ask again.'};
     else{pending.current=true;setResearching(true);try{const args=JSON.parse(e.arguments??'{}');if(e.name!=='ask_hypergreen'||typeof args.question!=='string'||args.question.length>8000)throw new Error('Invalid research request');const result=await callbacks.current.ask(args.question,true);output={answer:result.answer,dataset:result.dataset};}catch(err){output={error:err instanceof Error?err.message:'Research is unavailable. Please use text chat.'}}finally{pending.current=false;if(current())setResearching(false)}}
     if(current()&&dc.readyState==='open'){dc.send(JSON.stringify({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output:JSON.stringify(output)}}));dc.send(JSON.stringify({type:'response.create'}))}
    }
   };
   pc.onconnectionstatechange=()=>{if(current()&&(pc.connectionState==='failed'||pc.connectionState==='disconnected'||pc.connectionState==='closed')){stop();setError('Voice disconnected. Your microphone is off. Reconnect to continue.')}};
   active.current.timer=setTimeout(()=>{if(current()){stop();setError('The voice connection timed out. Please try again.');}},30000);
   await pc.setLocalDescription(await pc.createOffer());
   if(pc.iceGatheringState!=='complete')await new Promise<void>((resolve)=>{const timeout=setTimeout(done,3000);function done(){clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',change);resolve()}function change(){if(pc.iceGatheringState==='complete')done()}pc.addEventListener('icegatheringstatechange',change);c.signal.addEventListener('abort',done,{once:true})});
   if(!current())return;
   const result=await apiJson<{sdp:string}>('/api/voice/session',{method:'POST',body:JSON.stringify({sdp:pc.localDescription?.sdp}),signal:c.signal});if(current())await pc.setRemoteDescription({type:'answer',sdp:result.sdp});
  }catch(e){if(current()){stop();setError(e instanceof DOMException&&e.name==='NotAllowedError'?'Microphone access was not granted. You can allow it in your browser or keep using text chat.':e instanceof Error?e.message:'Voice could not connect. Please use text chat.')}}
 }
 return {state,error,transcript,researching,start,stop};
}
