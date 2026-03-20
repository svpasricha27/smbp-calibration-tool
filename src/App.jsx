import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "./supabase.js";

const NAVY = "#0F2B4C", NAVY_MID = "#1A3D6B", SLATE = "#3D5A80";
const GREEN = "#1B8A5A", GREEN_LT = "#E4F5ED";
const AMBER = "#E9A319", AMBER_LT = "#FFF8E7";
const RED = "#C1292E", RED_LT = "#FDE8E8";
const BG = "#F7F8FA", BORDER = "#D8DCE6", TEXT2 = "#5A6178";

const AGE_RANGES = ["18-30","31-40","41-50","51-60","61-70","71-80","81+"];
const SEX_OPTIONS = ["Male","Female","Other"];

function CalcVal({ value, bold }) {
  const has = value !== "—";
  return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:48,padding:"4px 10px",background:has?"white":BG,border:`1.5px solid ${has?NAVY_MID:BORDER}`,borderRadius:6,fontWeight:bold?700:600,fontSize:14,color:NAVY }}>{value}</span>;
}

function ResultBadge({ type, active, title, desc }) {
  const c={pass:GREEN,proceed:AMBER,fail:RED}[type];
  const bg={pass:GREEN_LT,proceed:AMBER_LT,fail:RED_LT}[type];
  const icon={pass:"✓",proceed:"→",fail:"✕"}[type];
  return (
    <div style={{ flex:1,display:"flex",alignItems:"center",gap:10,padding:14,borderRadius:8,border:`2px solid ${active?c:BORDER}`,background:active?bg:"white",opacity:active?1:0.4,position:"relative",transform:active?"scale(1.02)":"scale(1)",boxShadow:active?"0 2px 12px rgba(0,0,0,0.08)":"none",transition:"all 0.3s" }}>
      {active&&<span style={{position:"absolute",top:-7,right:-7,width:20,height:20,borderRadius:"50%",background:c,color:"white",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</span>}
      <span style={{width:28,height:28,borderRadius:"50%",background:c,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{icon}</span>
      <div>
        <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4,color:c}}>{title}</div>
        <div style={{fontSize:11,color:TEXT2,marginTop:1}}>{desc}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [calcResults, setCalcResults] = useState({});
  const [sex, setSex] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [arm, setArm] = useState("right");
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState(null); // null, "test", "submit"
  const [stats, setStats] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));

  const refs = useRef({});
  const calcTimer = useRef(null);

  const reg = useCallback((id) => (el) => { if (el) refs.current[id] = el; }, []);
  const getRef = useCallback((id) => refs.current[id]?.value?.trim() || "", []);
  const getNum = useCallback((id) => { const n = parseFloat(refs.current[id]?.value); return isNaN(n)?null:n; }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("calibration_stats").select("*").single();
        if (data) setStats(data);
      } catch {}
      try {
        const { data: devices } = await supabase.from("device_stats").select("*").limit(12);
        if (devices) setStats(prev => ({ ...prev, devices }));
      } catch {}
      try {
        const { data: locations } = await supabase.from("location_stats").select("*").limit(10);
        if (locations) setStats(prev => ({ ...prev, locations }));
      } catch {}
    })();
  }, [submitted]);

  const doCalc = useCallback(() => {
    const B=getNum("b_sys"),C=getNum("c_sys"),D=getNum("d_sys"),E=getNum("e_sys");
    let s2avg=null,s2diff=null,s2result=null;
    if(B!==null&&D!==null&&C!==null){s2avg=(B+D)/2;s2diff=Math.abs(s2avg-C);s2result=s2diff<=5?"pass":s2diff<=10?"proceed":"fail";}
    let s3avg=null,s3diff=null,s3result=null;
    if(s2result==="proceed"&&C!==null&&E!==null&&D!==null){s3avg=(C+E)/2;s3diff=Math.abs(s3avg-D);s3result=s3diff<=10?"pass":"fail";}
    let finalResult=null;
    if(s2result==="pass")finalResult="pass";else if(s2result==="fail")finalResult="fail";else if(s2result==="proceed")finalResult=s3result;
    return {B,C,D,E,s2avg,s2diff,s2result,s3avg,s3diff,s3result,finalResult};
  },[getNum]);

  // Live preview of calc values only (no result display until button press)
  const scheduleRecalc = useCallback(() => {
    if(calcTimer.current) clearTimeout(calcTimer.current);
    calcTimer.current = setTimeout(() => {
      if(!mode) { // only update calc preview if no result shown yet
        const r = doCalc();
        setCalcResults({...r, finalResult: null, s2result: null, s3result: null}); // show values but not results
      }
    }, 250);
  },[doCalc, mode]);

  const onBPInput = useCallback((e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g,"");
    scheduleRecalc();
  },[scheduleRecalc]);

  const validate = useCallback((includeClinic) => {
    const errs = [];
    if(!getRef("clinicMake")) errs.push("Clinic Device Manufacturer");
    if(!getRef("clinicModel")) errs.push("Clinic Device Model");
    if(!getRef("homeMake")) errs.push("Home Device Make");
    if(!getRef("homeModel")) errs.push("Home Device Model");
    if(!getRef("city")) errs.push("City");
    if(!getRef("country")) errs.push("Country");
    if(!sex) errs.push("Sex");
    if(!ageRange) errs.push("Age Range");
    // Check all 5 BP readings have at least systolic
    if(!getNum("a_sys")) errs.push("Measurement A Systolic");
    if(!getNum("b_sys")) errs.push("Measurement B Systolic");
    if(!getNum("c_sys")) errs.push("Measurement C Systolic");
    if(!getNum("d_sys")) errs.push("Measurement D Systolic");
    if(!getNum("e_sys")) errs.push("Measurement E Systolic");
    return errs;
  },[sex,ageRange,getRef,getNum]);

  const handleAction = useCallback(async (actionMode) => {
    const errs = validate();
    if(errs.length>0){setValidationErrors(errs);return;}
    setValidationErrors([]);

    const results = doCalc();
    if(!results.finalResult){setValidationErrors(["Cannot calculate result — ensure B, C, D systolic values are entered"]);return;}

    setCalcResults(results);
    setMode(actionMode);

    if(actionMode === "submit") {
      try {
        const {error} = await supabase.from("calibration_entries").insert({
          sex, age_range:ageRange,
          clinic_device_make: getRef("clinicMake"),
          clinic_device_model: getRef("clinicModel"),
          clinic_device_purchase_year: getRef("clinicYear") || null,
          device_make: getRef("homeMake"),
          device_model: getRef("homeModel"),
          purchase_year: getRef("homeYear") || null,
          last_calibration: getRef("lastCalDate") || null,
          city: getRef("city"), country: getRef("country"),
          arm_used: arm, test_date: today,
          a_systolic:getNum("a_sys"),a_diastolic:getNum("a_dia"),
          b_systolic:getNum("b_sys"),b_diastolic:getNum("b_dia"),
          c_systolic:getNum("c_sys"),c_diastolic:getNum("c_dia"),
          d_systolic:getNum("d_sys"),d_diastolic:getNum("d_dia"),
          e_systolic:getNum("e_sys"),e_diastolic:getNum("e_dia"),
          step2_avg_bd:results.s2avg, step2_diff:results.s2diff, step2_result:results.s2result,
          step3_avg_ce:results.s3avg||null, step3_diff:results.s3diff||null, step3_result:results.s3result||null,
          final_result:results.finalResult,
          comments: refs.current.comments?.value || null,
        });
        if(!error) setSubmitted(true);
        else console.error("Supabase insert error:",error);
      } catch(e){console.error(e);}
    }
  },[validate,doCalc,sex,ageRange,arm,today,getRef,getNum]);

  const genNote = useCallback(() => {
    if(!calcResults.finalResult) return "";
    const bpIds=["a_sys","b_sys","c_sys","d_sys","e_sys","a_dia","b_dia","c_dia","d_dia","e_dia"];
    const r={};bpIds.forEach(id=>{r[id]=refs.current[id]?.value||"—";});
    const cm=getRef("clinicMake"),cmod=getRef("clinicModel");
    const dm=getRef("homeMake"),dmod=getRef("homeModel"),py=getRef("homeYear"),lc=getRef("lastCalDate");
    const ct=getRef("city"),co=getRef("country");
    const cmt=refs.current.comments?.value?.trim();
    const lines=[];
    lines.push("HOME BP DEVICE CALIBRATION — ASSESSMENT");
    lines.push("════════════════════════════════════════");
    lines.push("");
    lines.push(`Date of Assessment: ${today}`);
    lines.push(`Patient: ${sex}, age ${ageRange}`);
    lines.push(`Location: ${[ct,co].filter(Boolean).join(", ")}`);
    lines.push("");
    lines.push("DEVICE INFORMATION");
    lines.push(`Office/Clinic Device: ${cm} ${cmod}`);
    lines.push(`Patient Home Device: ${dm} ${dmod}${py?` (purchased ${py})`:""}`);
    if(lc) lines.push(`Patient reports last calibration: ${lc}`);
    lines.push("");
    lines.push("PROCEDURE");
    lines.push(`Following the validated Eguchi protocol (Blood Press Monit. 2012), five sequential blood pressure measurements were obtained using the patient's ${arm} arm, alternating between the patient's home device and the clinic device (${cm} ${cmod}). No rest period was required between measurements.`);
    lines.push("");
    lines.push("MEASUREMENTS (Systolic/Diastolic mmHg):");
    lines.push(`  Measurement A (Home device):   ${r.a_sys}/${r.a_dia}`);
    lines.push(`  Measurement B (Home device):   ${r.b_sys}/${r.b_dia}`);
    lines.push(`  Measurement C (Clinic device): ${r.c_sys}/${r.c_dia}`);
    lines.push(`  Measurement D (Home device):   ${r.d_sys}/${r.d_dia}`);
    lines.push(`  Measurement E (Clinic device): ${r.e_sys}/${r.e_dia}`);
    lines.push("");
    lines.push("ANALYSIS");
    lines.push("");
    lines.push("Step 2 — Primary Comparison:");
    lines.push(`The systolic readings from the patient's home device (measurements B and D) were averaged to obtain a mean home-device systolic pressure of ${calcResults.s2avg?.toFixed(1)} mmHg. This was compared against the first clinic reading (measurement C, ${calcResults.C} mmHg). The absolute difference between the home-device average and the clinic reading was ${calcResults.s2diff?.toFixed(1)} mmHg.`);
    lines.push("");
    if(calcResults.s2result==="pass"){
      lines.push(`This difference of ${calcResults.s2diff?.toFixed(1)} mmHg falls within the acceptable threshold of ≤5 mmHg, indicating that the patient's home device demonstrates adequate agreement with clinic equipment. No further testing was required.`);
    } else if(calcResults.s2result==="fail"){
      lines.push(`This difference of ${calcResults.s2diff?.toFixed(1)} mmHg exceeds the 10 mmHg threshold, indicating clinically significant discrepancy between the patient's device and clinic equipment. The device cannot be relied upon for accurate self-measured blood pressure monitoring and should be replaced.`);
    } else if(calcResults.s2result==="proceed"){
      lines.push(`This difference of ${calcResults.s2diff?.toFixed(1)} mmHg falls in the intermediate range of 6–10 mmHg, necessitating a second confirmatory comparison per protocol.`);
      lines.push("");
      lines.push("Step 3 — Confirmatory Comparison:");
      lines.push(`The two clinic readings (measurements C and E) were averaged to obtain a mean clinic systolic pressure of ${calcResults.s3avg?.toFixed(1)} mmHg. This was compared against the second home-device reading (measurement D, ${calcResults.D} mmHg). The absolute difference was ${calcResults.s3diff?.toFixed(1)} mmHg.`);
      lines.push("");
      if(calcResults.s3result==="pass"){
        lines.push(`This difference of ${calcResults.s3diff?.toFixed(1)} mmHg falls within the acceptable confirmatory threshold of ≤10 mmHg. Despite the borderline result in the primary comparison, the confirmatory test demonstrates sufficient agreement to validate the device for home use.`);
      } else {
        lines.push(`This difference of ${calcResults.s3diff?.toFixed(1)} mmHg exceeds the confirmatory threshold of 10 mmHg. Combined with the borderline primary comparison, this indicates the patient's device does not demonstrate reliable agreement with clinic equipment and should be replaced.`);
      }
    }
    lines.push("");
    lines.push("CONCLUSION");
    lines.push("════════════════════════════════════════");
    if(calcResults.finalResult==="pass"){
      lines.push(`PASS — The patient's home blood pressure device (${dm} ${dmod}) has been validated against clinic equipment (${cm} ${cmod}) and is suitable for self-measured blood pressure monitoring.`);
    } else {
      lines.push(`FAIL — The patient's home blood pressure device (${dm} ${dmod}) has failed calibration testing against clinic equipment (${cm} ${cmod}). The device should be replaced with a validated device.`);
    }
    if(cmt){lines.push("");lines.push(`Additional Comments: ${cmt}`);}
    lines.push("");
    lines.push("Protocol: Eguchi K, et al. Blood Press Monit. 2012;17(5):210-213.");
    lines.push("AMA MAP BP™ Quality Improvement Program.");
    return lines.filter(l=>l!==null).join("\n");
  },[calcResults,today,sex,ageRange,arm,getRef]);

  const copyNote = () => {navigator.clipboard.writeText(genNote()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});};

  const cr = calcResults;
  const inputStyle={width:"100%",padding:"8px 12px",border:`1.5px solid ${BORDER}`,borderRadius:6,fontSize:13,fontFamily:"inherit",background:"white",color:NAVY,boxSizing:"border-box"};
  const labelStyle={display:"block",fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:TEXT2,marginBottom:5};
  const reqDot=<span style={{color:RED,marginLeft:2}}>*</span>;
  const reqBg="#FFFAF0";
  const sectionTitle=(text)=><div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,color:SLATE,marginBottom:10,marginTop:16,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>{text}</div>;

  const btnBase = {padding:"12px 28px",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.2s",letterSpacing:0.3};

  return (
    <div style={{minHeight:"100vh",background:BG,fontFamily:"-apple-system,'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:780,margin:"0 auto",padding:"24px 20px"}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${NAVY} 0%,${NAVY_MID} 60%,${SLATE} 100%)`,borderRadius:"12px 12px 0 0",padding:"28px 32px",color:"white"}}>
          <h1 style={{fontSize:22,fontWeight:700,letterSpacing:-0.3,marginBottom:4}}>SMBP Device Calibration Tool</h1>
          <p style={{fontSize:13,fontWeight:300,opacity:0.85,margin:0}}>Self-Measured Blood Pressure Device Validation Protocol</p>
        </div>

        {/* Disclaimer */}
        <div style={{background:"#FFF9E6",borderLeft:`4px solid ${AMBER}`,padding:"12px 20px",fontSize:11.5,color:"#6B5900",lineHeight:1.7}}>
          <strong>Research & Privacy Disclaimer:</strong> This tool has been intentionally designed to avoid capturing any Protected Health Information (PHI). No patient names, dates of birth, health card numbers, or other identifying information are collected. Age is captured only as a broad range (e.g. 41–50) rather than exact age to prevent any possibility of re-identification. By using this tool, you acknowledge that anonymous, de-identified data (device info, calibration results, demographics, BP readings, approximate location) may be collected for research and quality improvement purposes.
        </div>

        {validationErrors.length>0&&(
          <div style={{background:RED_LT,border:`2px solid ${RED}`,padding:"12px 20px",fontSize:13,color:RED,lineHeight:1.6}}>
            <strong>Required fields missing:</strong> {validationErrors.join(", ")}
          </div>
        )}

        {/* Patient Demographics */}
        <div style={{background:"white",borderBottom:`1px solid ${BORDER}`,padding:"20px 32px"}}>
          {sectionTitle("Patient Demographics")}
          <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{flex:"0 0 130px"}}><label style={labelStyle}>Date</label><input type="text" value={today} readOnly style={{...inputStyle,background:BG}}/></div>
            <div style={{flex:1,minWidth:120}}><label style={labelStyle}>Sex{reqDot}</label>
              <select value={sex} onChange={e=>setSex(e.target.value)} style={{...inputStyle,cursor:"pointer",background:sex?"white":reqBg}}>
                <option value="">Select...</option>{SEX_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select></div>
            <div style={{flex:1,minWidth:140}}><label style={labelStyle}>Age Range{reqDot}</label>
              <select value={ageRange} onChange={e=>setAgeRange(e.target.value)} style={{...inputStyle,cursor:"pointer",background:ageRange?"white":reqBg}}>
                <option value="">Select...</option>{AGE_RANGES.map(a=><option key={a} value={a}>{a}</option>)}
              </select></div>
            <div style={{flex:1,minWidth:120}}>
              <label style={labelStyle}>Arm Used</label>
              <div style={{display:"flex",gap:16,paddingTop:8}}>
                {["right","left"].map(a=>(
                  <label key={a} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:13}}>
                    <input type="radio" name="arm" value={a} checked={arm===a} onChange={()=>setArm(a)} style={{accentColor:NAVY}}/>{a.charAt(0).toUpperCase()+a.slice(1)}
                  </label>))}
              </div></div>
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:160}}><label style={labelStyle}>City{reqDot}</label>
              <input ref={reg("city")} type="text" placeholder="e.g. Toronto" style={{...inputStyle,background:reqBg}}
                onFocus={e=>e.target.style.background="white"} onBlur={e=>{if(!e.target.value)e.target.style.background=reqBg}}/></div>
            <div style={{flex:1,minWidth:160}}><label style={labelStyle}>Country{reqDot}</label>
              <input ref={reg("country")} type="text" placeholder="e.g. Canada" style={{...inputStyle,background:reqBg}}
                onFocus={e=>e.target.style.background="white"} onBlur={e=>{if(!e.target.value)e.target.style.background=reqBg}}/></div>
          </div>

          {/* Clinic Device */}
          {sectionTitle("Clinic BP Device (Office Reference Device)")}
          <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:160}}><label style={labelStyle}>Manufacturer{reqDot}</label>
              <input ref={reg("clinicMake")} type="text" placeholder="e.g. Welch Allyn" style={{...inputStyle,background:reqBg}}
                onFocus={e=>e.target.style.background="white"} onBlur={e=>{if(!e.target.value)e.target.style.background=reqBg}}/></div>
            <div style={{flex:1,minWidth:160}}><label style={labelStyle}>Model{reqDot}</label>
              <input ref={reg("clinicModel")} type="text" placeholder="e.g. ProBP 3400" style={{...inputStyle,background:reqBg}}
                onFocus={e=>e.target.style.background="white"} onBlur={e=>{if(!e.target.value)e.target.style.background=reqBg}}/></div>
            <div style={{flex:"0 0 130px"}}><label style={labelStyle}>Purchase Year</label>
              <input ref={reg("clinicYear")} type="text" placeholder="e.g. 2022" maxLength={4} style={inputStyle}
                onInput={e=>{e.target.value=e.target.value.replace(/[^0-9]/g,"")}}/></div>
          </div>

          {/* Home Device */}
          {sectionTitle("Patient Home BP Device")}
          <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:140}}><label style={labelStyle}>Make{reqDot}</label>
              <input ref={reg("homeMake")} type="text" placeholder="e.g. Omron" style={{...inputStyle,background:reqBg}}
                onFocus={e=>e.target.style.background="white"} onBlur={e=>{if(!e.target.value)e.target.style.background=reqBg}}/></div>
            <div style={{flex:1,minWidth:140}}><label style={labelStyle}>Model{reqDot}</label>
              <input ref={reg("homeModel")} type="text" placeholder="e.g. HEM-7156T" style={{...inputStyle,background:reqBg}}
                onFocus={e=>e.target.style.background="white"} onBlur={e=>{if(!e.target.value)e.target.style.background=reqBg}}/></div>
            <div style={{flex:"0 0 120px"}}><label style={labelStyle}>Purchase Year</label>
              <input ref={reg("homeYear")} type="text" placeholder="e.g. 2023" maxLength={4} style={inputStyle}
                onInput={e=>{e.target.value=e.target.value.replace(/[^0-9]/g,"")}}/></div>
            <div style={{flex:1,minWidth:160}}><label style={labelStyle}>Last Calibration</label>
              <input ref={reg("lastCalDate")} type="text" placeholder="e.g. 2024-06 or Never" style={inputStyle}/></div>
          </div>
        </div>

        {/* Step 1 */}
        <div style={{background:"white",boxShadow:"0 2px 12px rgba(15,43,76,0.08)",marginBottom:20,borderRadius:"0 0 12px 12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 32px",background:NAVY,color:"white",fontWeight:600,fontSize:14}}>
            <span style={{width:26,height:26,background:"rgba(255,255,255,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}}>1</span>
            Take Five BP Measurements (Same Arm)
          </div>
          <div style={{padding:"12px 32px",fontSize:13,color:TEXT2,borderBottom:`1px solid ${BORDER}`}}>
            Using the same arm, take five BP measurements alternating between the patient's home device and the clinic device. No rest period required.
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:SLATE}}>
              {["Meas.","Device","Systolic (mmHg)","Diastolic (mmHg)"].map((h,i)=>(
                <th key={h} style={{padding:"10px 16px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,color:"white",textAlign:i===1?"left":"center"}}>{h}</th>
              ))}</tr></thead>
            <tbody>
              {[["A","Patient's home device",true],["B","Patient's home device",false],["C","Clinic device",true],["D","Patient's home device",false],["E","Clinic device",true]].map(([letter,device,odd])=>(
                <tr key={letter} style={{background:odd?BG:"white",borderBottom:`1px solid ${BORDER}`}}>
                  <td style={{padding:"8px 16px",textAlign:"center"}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:6,background:NAVY,color:"white",fontWeight:700,fontSize:14}}>{letter}</span></td>
                  <td style={{padding:"8px 16px",fontSize:13.5}}>{device}</td>
                  {["sys","dia"].map(t=>(
                    <td key={t} style={{padding:"8px 16px",textAlign:"center"}}>
                      <input ref={reg(`${letter.toLowerCase()}_${t}`)} onInput={onBPInput} inputMode="numeric" maxLength={3} placeholder="—"
                        style={{width:80,padding:"8px 6px",border:`1.5px solid ${BORDER}`,borderRadius:6,fontSize:15,fontWeight:600,textAlign:"center",fontFamily:"inherit",background:"white",color:NAVY}}/>
                    </td>))}
                </tr>))}
            </tbody>
          </table>

          {/* Submit / Test buttons */}
          <div style={{padding:"20px 32px",display:"flex",gap:12,alignItems:"center",borderTop:`1px solid ${BORDER}`,flexWrap:"wrap"}}>
            <button onClick={()=>handleAction("submit")} disabled={submitted}
              style={{...btnBase,background:submitted?"#999":GREEN,color:"white",opacity:submitted?0.6:1}}>
              {submitted?"✓ Submitted":"Submit & Save to Database"}
            </button>
            <button onClick={()=>handleAction("test")}
              style={{...btnBase,background:"white",color:SLATE,border:`2px solid ${SLATE}`}}>
              Test Only (No Save)
            </button>
            <span style={{fontSize:11.5,color:TEXT2,fontStyle:"italic"}}>
              {mode==="test"?"Test mode — data not saved":mode==="submit"&&submitted?"Data saved to research database":""}
            </span>
          </div>
        </div>

        {/* Results — only show after Submit or Test */}
        {mode && cr.finalResult && (<>

          {/* Step 2 */}
          <div style={{background:"white",borderRadius:12,boxShadow:"0 2px 12px rgba(15,43,76,0.08)",marginBottom:20,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 32px",background:NAVY,color:"white",fontWeight:600,fontSize:14,borderRadius:"12px 12px 0 0"}}>
              <span style={{width:26,height:26,background:"rgba(255,255,255,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}}>2</span>
              Compare Patient's Device to Clinic (First Check)
            </div>
            <div style={{padding:"20px 32px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,fontSize:14,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,color:NAVY,minWidth:48}}>Part 1:</span>
                <span style={{color:TEXT2}}>Avg(B, D) = (</span><CalcVal value={cr.B!=null?String(cr.B):"—"}/><span style={{color:TEXT2}}>+</span><CalcVal value={cr.D!=null?String(cr.D):"—"}/><span style={{color:TEXT2}}>) / 2 =</span><CalcVal value={cr.s2avg!=null?cr.s2avg.toFixed(1):"—"} bold/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,fontSize:14,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,color:NAVY,minWidth:48}}>Part 2:</span>
                <span style={{color:TEXT2}}>| Avg(B,D) − C | = |</span><CalcVal value={cr.s2avg!=null?cr.s2avg.toFixed(1):"—"}/><span style={{color:TEXT2}}>−</span><CalcVal value={cr.C!=null?String(cr.C):"—"}/><span style={{color:TEXT2}}>| =</span><CalcVal value={cr.s2diff!=null?cr.s2diff.toFixed(1):"—"} bold/><span style={{fontSize:12,color:TEXT2}}>mmHg</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14}}><span style={{fontWeight:700,color:NAVY,minWidth:48}}>Part 3:</span><span style={{color:TEXT2}}>Result:</span></div>
            </div>
            <div style={{display:"flex",gap:10,padding:"0 32px 24px"}}>
              <ResultBadge type="pass" active={cr.s2result==="pass"} title="Pass — ≤ 5 mmHg" desc="Device OK for SMBP"/>
              <ResultBadge type="proceed" active={cr.s2result==="proceed"} title="Proceed — 6–10 mmHg" desc="Go to Step 3"/>
              <ResultBadge type="fail" active={cr.s2result==="fail"} title="Fail — > 10 mmHg" desc="Replace device"/>
            </div>
          </div>

          {/* Step 3 */}
          {cr.s2result==="proceed"&&(
            <div style={{background:"white",borderRadius:12,boxShadow:"0 2px 12px rgba(15,43,76,0.08)",marginBottom:20,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 32px",background:NAVY,color:"white",fontWeight:600,fontSize:14,borderRadius:"12px 12px 0 0"}}>
                <span style={{width:26,height:26,background:"rgba(255,255,255,0.2)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}}>3</span>
                Second Check (Step 2 was 6–10 mmHg)
              </div>
              <div style={{padding:"20px 32px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,fontSize:14,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:NAVY,minWidth:48}}>Part 1:</span>
                  <span style={{color:TEXT2}}>Avg(C, E) = (</span><CalcVal value={cr.C!=null?String(cr.C):"—"}/><span style={{color:TEXT2}}>+</span><CalcVal value={cr.E!=null?String(cr.E):"—"}/><span style={{color:TEXT2}}>) / 2 =</span><CalcVal value={cr.s3avg!=null?cr.s3avg.toFixed(1):"—"} bold/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,fontSize:14,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:NAVY,minWidth:48}}>Part 2:</span>
                  <span style={{color:TEXT2}}>| Avg(C,E) − D | = |</span><CalcVal value={cr.s3avg!=null?cr.s3avg.toFixed(1):"—"}/><span style={{color:TEXT2}}>−</span><CalcVal value={cr.D!=null?String(cr.D):"—"}/><span style={{color:TEXT2}}>| =</span><CalcVal value={cr.s3diff!=null?cr.s3diff.toFixed(1):"—"} bold/><span style={{fontSize:12,color:TEXT2}}>mmHg</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14}}><span style={{fontWeight:700,color:NAVY,minWidth:48}}>Part 3:</span><span style={{color:TEXT2}}>Result:</span></div>
              </div>
              <div style={{display:"flex",gap:10,padding:"0 32px 24px"}}>
                <ResultBadge type="pass" active={cr.s3result==="pass"} title="Pass — ≤ 10 mmHg" desc="Device can be used for SMBP"/>
                <ResultBadge type="fail" active={cr.s3result==="fail"} title="Fail — > 10 mmHg" desc="Replace device"/>
              </div>
            </div>
          )}

          {/* Final Determination */}
          <div style={{borderRadius:12,overflow:"hidden",boxShadow:"0 8px 32px rgba(15,43,76,0.12)",marginBottom:20}}>
            <div style={{background:NAVY,color:"white",padding:"16px 32px",fontSize:15,fontWeight:700}}>Final Determination</div>
            <div style={{padding:"24px 32px",background:"white"}}>
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderRadius:10,fontSize:16,fontWeight:700,marginBottom:16,
                ...(cr.finalResult==="pass"?{background:GREEN_LT,color:GREEN,border:`2px solid ${GREEN}`}:{background:RED_LT,color:RED,border:`2px solid ${RED}`})}}>
                <span style={{fontSize:28}}>{cr.finalResult==="pass"?"✅":"❌"}</span>
                <span>{cr.finalResult==="pass"?"PASS — Device is validated for self-measured blood pressure monitoring":"FAIL — Device must be replaced before proceeding with SMBP"}</span>
              </div>
              {mode==="test"&&<div style={{background:AMBER_LT,border:`1px solid ${AMBER}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:"#6B5900",marginBottom:16}}>⚠️ Test mode — this result was NOT saved to the research database.</div>}
              {submitted&&<div style={{background:"#F0F7FF",border:"1px solid #C5DAF0",borderRadius:8,padding:"10px 14px",fontSize:12,color:SLATE,marginBottom:16}}>✓ Calibration data saved to research database.</div>}
              <textarea ref={reg("comments")} placeholder="Comments (optional)..."
                style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${BORDER}`,borderRadius:6,fontFamily:"inherit",fontSize:13,resize:"vertical",minHeight:50,background:"white",color:NAVY,boxSizing:"border-box"}}/>
            </div>
          </div>

          {/* Clinical Note */}
          <div style={{borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,43,76,0.08)",marginBottom:20,background:"white"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:SLATE,color:"white",padding:"14px 32px"}}>
              <span style={{fontWeight:700,fontSize:14}}>📋 Clinical Note — Copy to EHR</span>
              <button onClick={copyNote} style={{padding:"7px 18px",background:copied?GREEN:"rgba(255,255,255,0.2)",color:"white",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                {copied?"✓ Copied!":"Copy to Clipboard"}</button>
            </div>
            <pre style={{padding:"20px 32px",fontSize:12.5,lineHeight:1.7,fontFamily:"'Courier New',monospace",color:NAVY,background:"#F8F9FC",margin:0,whiteSpace:"pre-wrap",overflowX:"auto"}}>{genNote()}</pre>
          </div>
        </>)}

        {/* Research Stats */}
        {stats&&stats.total_tests>0&&(
          <div style={{borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(15,43,76,0.08)",marginBottom:20,background:"white"}}>
            <div style={{padding:"14px 32px",background:"#F0F2F7",borderBottom:`1px solid ${BORDER}`}}>
              <span style={{fontWeight:700,fontSize:13,color:SLATE}}>📊 Research Data — Aggregate (All Users)</span>
            </div>
            <div style={{padding:"16px 32px",display:"flex",gap:20,flexWrap:"wrap",borderBottom:`1px solid ${BORDER}`}}>
              {[[stats.total_tests,"Total Tests",NAVY],[stats.total_passes,"Passed",GREEN],[stats.total_fails,"Failed",RED],
                [`${stats.pass_rate_pct}%`,"Pass Rate",NAVY],
                ...(stats.mean_step2_diff?[[stats.mean_step2_diff,"Mean Step 2 Diff",SLATE]]:[]),
              ].map(([v,label,color])=>(
                <div key={label} style={{textAlign:"center",minWidth:60}}>
                  <div style={{fontSize:24,fontWeight:700,color}}>{v}</div>
                  <div style={{fontSize:10,color:TEXT2,textTransform:"uppercase",letterSpacing:0.4}}>{label}</div>
                </div>))}
            </div>
            {stats.devices?.length>0&&(
              <div style={{padding:"14px 32px",borderBottom:`1px solid ${BORDER}`}}>
                <div style={{fontSize:10,fontWeight:700,color:SLATE,textTransform:"uppercase",marginBottom:8}}>By Device</div>
                {stats.devices.map(d=>(
                  <div key={`${d.device_make}${d.device_model}`} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${BG}`,fontSize:12}}>
                    <span style={{color:NAVY,fontWeight:600}}>{d.device_make} {d.device_model}</span>
                    <span style={{color:TEXT2}}>{d.passes}/{d.total_tests} passed ({d.pass_rate_pct}%)</span>
                  </div>))}
              </div>)}
            {stats.locations?.length>0&&(
              <div style={{padding:"14px 32px"}}>
                <div style={{fontSize:10,fontWeight:700,color:SLATE,textTransform:"uppercase",marginBottom:8}}>By Location</div>
                {stats.locations.map(l=>(
                  <div key={`${l.city}${l.country}`} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${BG}`,fontSize:12}}>
                    <span style={{color:NAVY,fontWeight:600}}>{l.city}, {l.country}</span>
                    <span style={{color:TEXT2}}>{l.total_tests} test{l.total_tests>1?"s":""} ({l.pass_rate_pct}% pass)</span>
                  </div>))}
              </div>)}
          </div>
        )}

        <div style={{textAlign:"center",padding:"16px 32px",fontSize:10.5,color:"#999",lineHeight:1.6}}>
          Adapted from: Eguchi et al. A Novel and Simple Protocol for the Validation of Home BP Monitors.<br/>
          Blood Press Monit. 2012;17(5):210-213 &nbsp;|&nbsp; AMA MAP BP™ Quality Improvement Program.
        </div>
      </div>
    </div>
  );
}
