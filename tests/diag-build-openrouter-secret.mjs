const present=Boolean(String(process.env.OPENROUTER_API_KEY||"").trim());
if(!present){console.error("OPENROUTER_BUILD_SECRET_NOT_AVAILABLE");process.exit(2)}
console.log(JSON.stringify({ok:true,suite:"openrouter-build-secret-probe",secret_present:true,secret_echo:false,paid_call:false}));
