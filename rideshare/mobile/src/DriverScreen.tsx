import TripIntegrations from './TripIntegrations';
import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet,Linking,AppState} from 'react-native';
import {theme} from './theme';
type Driver={state:()=>any;readOnboarding:()=>Promise<any>;submitDocuments:(v:any)=>Promise<any>;readAvailability:()=>Promise<any>;setAvailability:(v:any)=>Promise<any>;readOffers:()=>Promise<any>;respondOffer:(id:string,yes:boolean)=>Promise<any>;readTrip:(id:string)=>Promise<any>;transition:(a:string)=>Promise<any>;navigation:()=>Promise<any>;reportSafety:(category:string)=>Promise<any>;suspend:()=>void};
export default function DriverScreen({journey,integrations}:{journey?:Driver;integrations?:any}){
 const [vehicle,setVehicle]=useState(''),[receipt,setReceipt]=useState(''),[expiry,setExpiry]=useState(''),[kind,setKind]=useState('licence'),[seats,setSeats]=useState('4'),[tripId,setTripId]=useState(''),[category,setCategory]=useState('other');
 const [notice,setNotice]=useState('Driver services are not configured.'),[busy,setBusy]=useState(false),[,update]=useState(0);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active'){journey?.suspend();update(x=>x+1);}});return ()=>{sub.remove();journey?.suspend();};},[journey]);
 const snapshot=journey?.state(),available=!!journey&&!busy;
 const run=async(fn:()=>Promise<unknown>)=>{if(!available)return;setBusy(true);try{await fn();setNotice('Authoritative response received; review current status.');update(x=>x+1);}catch{setNotice('Request denied or offline. No availability, offer or trip change is confirmed.');}finally{setBusy(false);}};
 return <View style={styles.root}>
  <Text accessibilityRole="header" style={styles.title}>Driver workspace</Text>
  <Text style={styles.warning}>NONPRODUCTION PREVIEW — No driver approval, dispatch or public rides enabled.</Text>
  <Text accessibilityRole="header" style={styles.heading}>Independent onboarding review</Text>
  <Button label="Refresh onboarding status" enabled={available} onPress={()=>run(()=>journey!.readOnboarding())}/>
  <Text>Review status: {snapshot?.review?.status??'Unverified — cannot drive'}</Text>
  <TextInput style={styles.field} accessibilityLabel="Vehicle reference" placeholder="Vehicle reference" value={vehicle} onChangeText={setVehicle}/>
  <TextInput style={styles.field} accessibilityLabel="Private document upload receipt" placeholder="Private upload receipt reference" value={receipt} onChangeText={setReceipt}/>
  <TextInput style={styles.field} accessibilityLabel="Document type" placeholder="Document type" value={kind} onChangeText={setKind}/>
  <TextInput style={styles.field} accessibilityLabel="Document expiry Unix seconds" placeholder="Document expiry in Unix seconds" keyboardType="number-pad" value={expiry} onChangeText={setExpiry}/>
  <Button label="Submit document receipt for independent review" enabled={available&&!!snapshot?.review} onPress={()=>run(()=>journey!.submitDocuments({vehicleId:vehicle,kind,privateRef:receipt,expiresAt:Number(expiry)}))}/>
  <Text accessibilityRole="header" style={styles.heading}>Availability and offers</Text>
  <Button label="Refresh driver availability" enabled={available} onPress={()=>run(()=>journey!.readAvailability())}/>
  <Text>Availability: {snapshot?.availability?.active?'Server confirms active':'Not confirmed online'}</Text>
  <TextInput style={styles.field} accessibilityLabel="Passenger capacity" placeholder="Passenger capacity" keyboardType="number-pad" value={seats} onChangeText={setSeats}/>
  <Button label="Request online availability" enabled={available&&!!snapshot?.availability} onPress={()=>run(()=>journey!.setAvailability({online:true,vehicleId:vehicle||snapshot.availability.vehicleId,seats:Number(seats)}))}/>
  <Button label="Go offline" enabled={available&&!!snapshot?.availability} onPress={()=>run(()=>journey!.setAvailability({online:false,vehicleId:vehicle||snapshot.availability.vehicleId}))}/>
  <Button label="Refresh offers" enabled={available} onPress={()=>run(()=>journey!.readOffers())}/>
  {(snapshot?.offers??[]).map((o:any)=><View key={o.offerId} style={styles.item}><Text>Offer {o.offerId} — {o.status}; expires at {new Date(o.expiresAt*1000).toLocaleString()}</Text>
  <Button label={'Accept offer '+o.offerId} enabled={available&&o.canRespond} onPress={()=>run(()=>journey!.respondOffer(o.offerId,true))}/>
  <Button label={'Reject offer '+o.offerId} enabled={available&&o.canRespond} onPress={()=>run(()=>journey!.respondOffer(o.offerId,false))}/></View>)}
  <Text accessibilityRole="header" style={styles.heading}>Trip controls and safety</Text>
  <TextInput style={styles.field} accessibilityLabel="Assigned trip ID" placeholder="Assigned trip ID" value={tripId} onChangeText={setTripId}/>
  <Button label="Refresh assigned trip" enabled={available&&tripId.length>0} onPress={()=>run(()=>journey!.readTrip(tripId))}/>
  <Text>Verified trip state: {snapshot?.trip?.state??'No verified trip'}</Text>
  <Button label="Request arrival transition" enabled={available&&snapshot?.trip?.state==='ASSIGNED'} onPress={()=>run(()=>journey!.transition('arrive'))}/>
  <Button label="Request trip start" enabled={available&&snapshot?.trip?.state==='ARRIVED'} onPress={()=>run(()=>journey!.transition('start'))}/>
  <Button label="Request trip completion" enabled={available&&snapshot?.trip?.state==='IN_PROGRESS'} onPress={()=>run(()=>journey!.transition('complete'))}/>
  <Button label="Request approved navigation handoff" enabled={available&&!!snapshot?.trip} onPress={()=>run(async()=>{const url=await journey!.navigation();if(typeof url!=='string'||!url.startsWith('https://'))throw Error('NAVIGATION_DENIED');await Linking.openURL(url);})}/>
  <TextInput style={styles.field} accessibilityLabel="Incident category" placeholder="medical, collision, threat, vehicle, other" value={category} onChangeText={setCategory}/>
  <Button label="Report safety incident" enabled={available&&!!snapshot?.trip&&['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(snapshot.trip.state)} onPress={()=>run(()=>journey!.reportSafety(category))}/>
  <TripIntegrations trip={snapshot?.trip} consumer={integrations}/>
  <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>
 </View>;
}
function Button({label,enabled,onPress}:{label:string;enabled:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!enabled}} disabled={!enabled} onPress={onPress} style={[styles.button,!enabled&&{opacity:0.5}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;}
const styles=StyleSheet.create({root:{gap:12},title:{fontSize:26,fontWeight:'800',color:theme.forest},heading:{fontSize:19,fontWeight:'700',color:theme.ink,marginTop:15},warning:{padding:12,backgroundColor:theme.mint,color:theme.ink,fontWeight:'700'},field:{padding:12,minHeight:48,borderWidth:1,borderRadius:8,borderColor:theme.border,color:theme.ink,backgroundColor:theme.white},button:{minHeight:48,padding:12,borderRadius:8,justifyContent:'center',backgroundColor:theme.forest},buttonText:{color:theme.white,fontWeight:'700',textAlign:'center'},item:{gap:8,padding:12,borderWidth:1,borderColor:theme.border},notice:{fontSize:16,color:theme.ink,padding:10}});
