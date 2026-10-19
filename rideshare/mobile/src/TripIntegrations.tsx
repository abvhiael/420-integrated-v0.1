import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet,AppState} from 'react-native';
import {theme} from './theme';
type Consumer={requestWalletIntent:(trip:any,consent:boolean)=>Promise<any>;readPayment:(trip:any)=>Promise<any>;travelPreview:(trip:any,consent:boolean)=>Promise<any>;requestNotifications:(trip:any,consent:boolean)=>Promise<any>;readMessages:(trip:any)=>Promise<any>;sendMessage:(trip:any,text:string)=>Promise<any>;clear:()=>void};
export default function TripIntegrations({trip,consumer}:{trip:any;consumer?:Consumer}){
 const [notice,setNotice]=useState('Integration services unavailable until approved testnet assembly.'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[payment,setPayment]=useState<any>(null),[messages,setMessages]=useState<any[]>([]);
 useEffect(()=>{const s=AppState.addEventListener('change',v=>{if(v!=='active'){consumer?.clear();setPayment(null);setMessages([]);}});return()=>{s.remove();consumer?.clear();};},[consumer]);
 const enabled=!!trip&&!!consumer&&!busy;
 async function run(fn:()=>Promise<any>,onResult?:(v:any)=>void){if(!enabled)return;setBusy(true);try{const v=await fn();onResult?.(v);setNotice('Authoritative service response received. No delivery, payment or booking is presumed.');}catch{setNotice('Service unavailable or not authorized; no action is confirmed.');}finally{setBusy(false);}}
 return <View style={styles.root}>
  <Text accessibilityRole="header" style={styles.header}>Trip services</Text>
  <Text style={styles.alert}>NONPRODUCTION — Wallet signing, payments, push delivery and Travel bookings are not enabled.</Text>
  <Text accessibilityRole="header" style={styles.section}>Wallet and Pay</Text>
  <Text>Financial requests require explicit consent, a verified rider session and independent Wallet authorization.</Text>
  <Action label="Request payment intent with explicit consent" enabled={enabled} onPress={()=>run(()=>consumer!.requestWalletIntent(trip,true))}/>
  <Action label="Refresh authoritative payment status" enabled={enabled} onPress={()=>run(()=>consumer!.readPayment(trip),setPayment)}/>
  <Text>{payment?('Payment projection: '+String(payment.status??'server returned financial projection')):'No verified payment status'}</Text>
  <Text accessibilityRole="header" style={styles.section}>Travel ground connection</Text>
  <Action label="Consent to Travel preview" enabled={enabled} onPress={()=>run(()=>consumer!.travelPreview(trip,true))}/>
  <Text>Travel handoff is preview-only. It cannot book transportation or initiate a transaction.</Text>
  <Text accessibilityRole="header" style={styles.section}>Notifications</Text>
  <Action label="Request notification permission" enabled={enabled} onPress={()=>run(()=>consumer!.requestNotifications(trip,true))}/>
  <Text accessibilityRole="header" style={styles.section}>Verified trip communication</Text>
  <Action label="Refresh trip messages" enabled={enabled} onPress={()=>run(()=>consumer!.readMessages(trip),v=>setMessages(v.messages))}/>
  {messages.map((m:any)=><Text key={m.id}>{m.sender===trip?.riderId?'Rider':'Driver'}: {m.text}</Text>)}
  <TextInput accessibilityLabel="Trip participant message" value={message} onChangeText={setMessage} placeholder="Message the verified trip participant" placeholderTextColor="#58645d" multiline maxLength={1000} style={styles.input}/>
  <Action label="Send verified trip message" enabled={enabled&&message.trim().length>0} onPress={()=>run(async()=>{const value=await consumer!.sendMessage(trip,message);setMessage('');return value;})}/>
  <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>
 </View>;
}
function Action({label,enabled,onPress}:{label:string;enabled:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!enabled}} disabled={!enabled} onPress={onPress} style={[styles.button,!enabled&&{opacity:0.4}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;}
const styles=StyleSheet.create({root:{gap:12,marginTop:16},header:{fontSize:23,fontWeight:'800',color:theme.forest},section:{fontSize:18,fontWeight:'700',color:theme.ink,marginTop:14},alert:{backgroundColor:theme.mint,padding:12,color:theme.ink,fontWeight:'700'},button:{backgroundColor:theme.forest,borderRadius:8,padding:13,minHeight:48,justifyContent:'center'},buttonText:{color:theme.white,fontWeight:'700',textAlign:'center'},input:{minHeight:54,padding:12,borderColor:theme.border,borderWidth:1,color:theme.ink,backgroundColor:theme.white},notice:{fontSize:15,color:theme.ink}});
