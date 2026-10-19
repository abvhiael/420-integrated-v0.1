import TripIntegrations from './TripIntegrations';
import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {theme} from './theme';
type Journey={setPickup:(v:unknown)=>unknown;setDestination:(v:unknown)=>unknown;prepareRoute:()=>Promise<unknown>;requestQuote:()=>Promise<unknown>;consentAndRequest:()=>Promise<unknown>;refreshTrip:()=>Promise<unknown>;cancelTrip:()=>Promise<unknown>;reportSafety:(v:string)=>Promise<unknown>;preferences:(v:unknown)=>Promise<unknown>;state:()=>{route:any;quote:any;trip:any}};
export default function RiderScreen({journey}:{journey?:Journey}){
 const [pickup,setPickup]=useState(''),[destination,setDestination]=useState('');
 const [pickupLat,setPickupLat]=useState(''),[pickupLon,setPickupLon]=useState('');
 const [destLat,setDestLat]=useState(''),[destLon,setDestLon]=useState('');
 const [details,setDetails]=useState(''),[status,setStatus]=useState('No rider service is connected.');
 const [busy,setBusy]=useState(false),[largeText,setLargeText]=useState(false);
 const [,refresh]=useState(0);const snapshot=journey?.state();
 async function run(work:()=>Promise<unknown>){
  if(!journey||busy)return;setBusy(true);
  try{const result=await work();setStatus(result&&typeof result==='object'&&'kind' in result&&result.kind==='needs-resolution'?'Address resolution required.':'Server request completed; review the state below.');refresh(n=>n+1);}
  catch{setStatus('Service unavailable or request denied. No ride was confirmed.');}
  finally{setBusy(false);}
 }
 function address(label:string,lat:string,lon:string){
  if(!label.trim()||!lat.trim()||!lon.trim())throw Error('ADDRESS_REQUIRED');
  return {label:label.trim(),latitude:Number(lat),longitude:Number(lon),precision:'approximate',source:'manual'};
 }
 const available=!!journey&&!busy;
 return <View style={styles.root}>
  <Text accessibilityRole="header" style={styles.heading}>Your ride</Text>
  <Text style={styles.warning}>NONPRODUCTION PREVIEW — booking, payment and dispatch disabled until authorized services are connected.</Text>
  <Text accessibilityRole="header" style={styles.section}>Pickup and destination</Text>
  <TextInput accessibilityLabel="Pickup address" placeholder="Pickup address" placeholderTextColor="#58645d" value={pickup} onChangeText={setPickup} style={styles.field}/>
  <TextInput accessibilityLabel="Pickup latitude" placeholder="Pickup latitude" placeholderTextColor="#58645d" keyboardType="numbers-and-punctuation" value={pickupLat} onChangeText={setPickupLat} style={styles.field}/>
  <TextInput accessibilityLabel="Pickup longitude" placeholder="Pickup longitude" placeholderTextColor="#58645d" keyboardType="numbers-and-punctuation" value={pickupLon} onChangeText={setPickupLon} style={styles.field}/>
  <TextInput accessibilityLabel="Destination address" placeholder="Destination address" placeholderTextColor="#58645d" value={destination} onChangeText={setDestination} style={styles.field}/>
  <TextInput accessibilityLabel="Destination latitude" placeholder="Destination latitude" placeholderTextColor="#58645d" keyboardType="numbers-and-punctuation" value={destLat} onChangeText={setDestLat} style={styles.field}/>
  <TextInput accessibilityLabel="Destination longitude" placeholder="Destination longitude" placeholderTextColor="#58645d" keyboardType="numbers-and-punctuation" value={destLon} onChangeText={setDestLon} style={styles.field}/>
  <Action label="Prepare route" enabled={available} onPress={()=>run(async()=>{journey!.setPickup(address(pickup,pickupLat,pickupLon));journey!.setDestination(address(destination,destLat,destLon));return journey!.prepareRoute();})}/>
  <Text accessibilityRole="header" style={styles.section}>Fare and consent</Text>
  <Text>Only server-authorized, unexpired CAD quotes can be accepted.</Text>
  <Action label="Request fare quote" enabled={available&&!!snapshot?.route} onPress={()=>run(()=>journey!.requestQuote())}/>
  {snapshot?.quote?<Text>Quote ID: {snapshot.quote.quoteId}. Total: CAD {String((snapshot.quote.amounts.totalCents/100).toFixed(2))}. Expires: {new Date(snapshot.quote.expiresAt*1000).toLocaleString()}.</Text>:null}
  <Action label="Accept fare terms and request ride" enabled={available&&!!snapshot?.quote} onPress={()=>run(()=>journey!.consentAndRequest())}/>
  <Text accessibilityRole="header" style={styles.section}>Trip and safety</Text>
  <Text>{snapshot?.trip?'Server trip state: '+snapshot.trip.state:'No confirmed trip'}</Text>
  <Action label="Refresh trip" enabled={available&&!!snapshot?.trip} onPress={()=>run(()=>journey!.refreshTrip())}/>
  <Action label="Cancel eligible trip" enabled={available&&!!snapshot?.trip&&['REQUESTED','ASSIGNED','ARRIVED'].includes(snapshot.trip.state)} onPress={()=>run(()=>journey!.cancelTrip())}/>
  <TextInput accessibilityLabel="Safety report details" placeholder="Safety report details" placeholderTextColor="#58645d" value={details} onChangeText={setDetails} style={styles.field} multiline/>
  <Action label="Send safety report" enabled={available&&!!snapshot?.trip&&['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(snapshot.trip.state)&&details.trim().length>=3} onPress={()=>run(()=>journey!.reportSafety(details))}/>
  <Text accessibilityRole="header" style={styles.section}>Account preferences</Text>
  <Action label={largeText?'Disable large text preference':'Enable large text preference'} enabled={available} onPress={()=>run(async()=>{await journey!.preferences({largeText:!largeText});setLargeText(!largeText);})}/>
  <TripIntegrations trip={snapshot?.trip}/>
  <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
 </View>;
}
function Action({label,enabled,onPress}:{label:string;enabled:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!enabled}} disabled={!enabled} onPress={onPress} style={[styles.button,!enabled&&styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;}
const styles=StyleSheet.create({root:{gap:12,paddingTop:16},heading:{fontSize:27,fontWeight:'800',color:theme.forest},section:{fontSize:20,fontWeight:'700',color:theme.ink,marginTop:12},field:{borderWidth:1,borderColor:theme.border,borderRadius:9,padding:12,minHeight:48,color:theme.ink,backgroundColor:theme.white},warning:{padding:12,backgroundColor:theme.mint,color:theme.ink,fontWeight:'700'},button:{borderRadius:9,backgroundColor:theme.forest,padding:13,minHeight:48,justifyContent:'center'},disabled:{opacity:0.5},buttonText:{color:theme.white,textAlign:'center',fontWeight:'700'},status:{padding:12,color:theme.ink,fontSize:15}});