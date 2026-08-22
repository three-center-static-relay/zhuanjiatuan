import {profileExpertTask} from "./task-profile.js";

export function guardSemanticProfile(original={},semantic={}){
  const baseline=profileExpertTask(original),profile={...semantic},conflicts=[];
  const override=(key,value,reason)=>{if(profile[key]!==value){conflicts.push({field:key,semantic:profile[key]??null,guarded:value,reason});profile[key]=value}};
  if(baseline.task_domain!=="general"&&profile.task_domain&&profile.task_domain!==baseline.task_domain)override("task_domain",baseline.task_domain,"deterministic-domain-evidence");
  if(profile.task_domain==="coding"&&baseline.task_domain!=="coding"&&baseline.task_type!=="coding")override("task_domain",baseline.task_domain,"coding-without-coding-evidence");
  if(baseline.task_type!=="analysis"&&profile.task_type&&profile.task_type!==baseline.task_type)override("task_type",baseline.task_type,"deterministic-task-type-evidence");
  if(profile.task_type==="coding"&&baseline.task_type!=="coding")override("task_type",baseline.task_type,"coding-type-without-coding-evidence");
  const semanticDomains=Array.isArray(profile.semantic_task_domains)?profile.semantic_task_domains:[];
  if(baseline.task_domain!=="general")profile.semantic_task_domains=[...new Set([baseline.task_domain,...semanticDomains])].slice(0,6);
  return{profile,baseline,conflicts,guarded:conflicts.length>0};
}
