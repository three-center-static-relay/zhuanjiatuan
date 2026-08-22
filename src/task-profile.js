const DOMAINS = new Set(["general","legal","finance","coding","quantitative","medical","geospatial","business","policy","science","social","research"]);
const TASK_TYPES = new Set(["analysis","coding","quantitative","comparison","planning","synthesis","research"]);
const COMPLEXITY = new Set(["standard","high"]);
const DEPTH = new Set(["standard","deep"]);
const CONTEXT = new Set(["short","medium","long"]);
const LATENCY = new Set(["normal","fast"]);
const COST = new Set(["quality","balanced","economy"]);

function norm(v){return String(v ?? "").trim().toLowerCase().replace(/[_\s]+/g,"-")}
function pick(v,allowed,fallback){const n=norm(v);return allowed.has(n)?n:fallback}
function has(text,re){return re.test(text)}

function inferDomain(prompt){
  const p=prompt.toLowerCase();
  if(has(p,/(法律|法条|合规|诉讼|刑事|民事|合同|判例|law|legal|statute|litigation|compliance)/i))return "legal";
  if(has(p,/(金融|投资|股票|债券|基金|财务|估值|portfolio|finance|stock|bond|valuation)/i))return "finance";
  if(has(p,/(代码|编程|程序|bug|github|cloudflare|worker|javascript|typescript|python|api\b|coding|code\b)/i))return "coding";
  if(has(p,/(数学|统计|概率|蒙特卡罗|仿真|模拟|优化|回归|计量|quantitative|statistics|probability|simulation|optimization)/i))return "quantitative";
  if(has(p,/(医学|医疗|临床|症状|诊断|药物|疾病|medical|clinical|diagnosis|treatment)/i))return "medical";
  if(has(p,/(地图|地理|gis|经纬度|空间分析|位置数据|geospatial|latitude|longitude)/i))return "geospatial";
  if(has(p,/(商业|经营|公司|市场|营销|销售|客户|职业|就业|工作|岗位|收入|工资|薪资|外卖|快递|网约车|保安|business|market|marketing|sales|company|job|occupation|career|income|wage|courier|delivery|ride-hailing|security guard)/i))return "business";
  if(has(p,/(政策|政府|宏观|监管|公共政策|policy|government|macro)/i))return "policy";
  if(has(p,/(科学|物理|化学|生物|science|physics|chemistry|biology)/i))return "science";
  if(has(p,/(社会|心理|人群|舆情|行为|social|psychology|behavior)/i))return "social";
  if(has(p,/(文献|论文|研究|证据|资料|literature|paper|research|evidence)/i))return "research";
  return "general";
}

function inferTaskType(prompt,domain){
  const p=prompt.toLowerCase();
  if(domain==="coding")return "coding";
  if(domain==="quantitative")return "quantitative";
  if(has(p,/(对比|比较|区别|优劣|哪个好|哪种更好|排名|vs\.?|versus|compare|comparison|which is better|rank)/i))return "comparison";
  if(has(p,/(方案|规划|路线图|策略|设计|计划|plan|strategy|roadmap|design)/i))return "planning";
  if(has(p,/(汇总|综合|归纳|整合|synthesi[sz]e|summary|aggregate)/i))return "synthesis";
  if(has(p,/(文献|论文|研究|证据|资料|research|literature|evidence)/i))return "research";
  return "analysis";
}

export function profileExpertTask(input={}){
  const prompt=String(input.prompt||"");
  const chars=prompt.length;
  const inferredDomain=inferDomain(prompt);
  const task_domain=pick(input.task_domain ?? input.domain,DOMAINS,inferredDomain);
  const task_type=pick(input.task_type,TASK_TYPES,inferTaskType(prompt,task_domain));
  const complexity=pick(input.complexity,COMPLEXITY,(chars>4000||has(prompt,/(复杂|多步骤|系统性|深度|全面|严谨|multi-step|complex|deep analysis|comprehensive)/i))?"high":"standard");
  const reasoning_depth=pick(input.reasoning_depth,DEPTH,(complexity==="high"||has(prompt,/(推理|因果|证明|博弈|策略|权衡|reasoning|causal|proof|trade-?off)/i))?"deep":"standard");
  const context_size=pick(input.context_size,CONTEXT,chars>12000?"long":chars>3000?"medium":"short");
  const latency_priority=pick(input.latency_priority,LATENCY,"normal");
  const cost_priority=pick(input.cost_priority,COST,"balanced");
  return {task_domain,task_type,complexity,reasoning_depth,context_size,latency_priority,cost_priority};
}

export const TASK_PROFILE_SCHEMA={
  task_domain:[...DOMAINS],task_type:[...TASK_TYPES],complexity:[...COMPLEXITY],reasoning_depth:[...DEPTH],context_size:[...CONTEXT],latency_priority:[...LATENCY],cost_priority:[...COST]
};
