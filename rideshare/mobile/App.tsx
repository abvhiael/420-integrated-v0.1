import React,{useState} from 'react';
import {SafeAreaView,ScrollView,View,Text,Pressable,StyleSheet,useColorScheme} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {previewState} from './src/route-policy.mjs';
import {theme} from './src/theme';
import RiderScreen from './src/RiderScreen';
import DriverScreen from './src/DriverScreen';

type Role='rider'|'driver'|null;
export default function App() {
 const [role,setRole]=useState<Role>(null);
 const [route,setRoute]=useState('welcome');
 const state=previewState(role,route);
 const dark=useColorScheme()==='dark';
 function choose(next:Exclude<Role,null>){setRole(next);setRoute(next);}
 function exit(){setRole(null);setRoute('welcome');}
 return <SafeAreaView style={[styles.root,{backgroundColor:dark?theme.ink:theme.cream}]}>
  <StatusBar style={dark?'light':'dark'}/>
  <ScrollView contentContainerStyle={styles.page} accessibilityLabel="LIFTd mobile preview">
   <Text accessibilityRole="header" style={[styles.brand,{color:dark?theme.mint:theme.forest}]}>LIFTd</Text>
   <Text style={[styles.subtitle,{color:dark?theme.white:theme.ink}]}>arrive higher</Text>
   <View style={styles.notice} accessible accessibilityLabel="Nonproduction preview. Booking, dispatch, payments and driver availability are disabled.">
    <Text style={styles.noticeText}>NONPRODUCTION PREVIEW — no bookings, dispatch or payments</Text>
   </View>
   <Text accessibilityRole="header" style={[styles.heading,{color:dark?theme.white:theme.ink}]}>{state.title}</Text>
   {state.route==='welcome'? <>
     <Text style={[styles.copy,{color:dark?theme.white:theme.ink}]}>Choose an interface to preview. No sign-in, live service or real ride is available.</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Open rider preview" onPress={()=>choose('rider')} style={styles.button}><Text style={styles.buttonLabel}>Rider preview</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Open driver preview" onPress={()=>choose('driver')} style={styles.button}><Text style={styles.buttonLabel}>Driver preview</Text></Pressable>
   </>:<>
     {state.route==='rider'?<RiderScreen/>:<DriverScreen/>}
     <View accessibilityRole="summary" style={styles.disabledCard}><Text style={styles.disabledText}>Service unavailable — testnet integration pending</Text></View>
     <Pressable accessibilityRole="button" accessibilityLabel="Return to role selection" onPress={exit} style={styles.button}><Text style={styles.buttonLabel}>Back to selection</Text></Pressable>
   </>}
   <Text style={[styles.footer,{color:dark?theme.white:theme.ink}]}>Vancouver pilot concept · operation not authorized</Text>
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 root:{flex:1},page:{flexGrow:1,padding:24,paddingTop:48,gap:18},
 brand:{fontSize:46,fontWeight:'900',letterSpacing:2},subtitle:{fontSize:17,fontWeight:'600'},
 notice:{backgroundColor:theme.mint,padding:14,borderRadius:8},noticeText:{color:theme.ink,fontSize:13,fontWeight:'800'},
 heading:{fontSize:28,fontWeight:'800',marginTop:18},copy:{fontSize:17,lineHeight:25},
 button:{minHeight:52,padding:14,justifyContent:'center',borderRadius:10,backgroundColor:theme.forest},
 buttonLabel:{color:theme.white,textAlign:'center',fontSize:17,fontWeight:'700'},
 disabledCard:{padding:22,borderRadius:10,borderWidth:2,borderColor:theme.border},
 disabledText:{color:theme.warning,fontSize:16,fontWeight:'600'},
 footer:{fontSize:12,marginTop:30}
});
