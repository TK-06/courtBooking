// Faculty and program lists for sign-up. Engineering students pick one of the
// faculty's 21 program codes; other faculties type their program as free text.
export const ENGINEERING = 'Engineering'

export const PROGRAM_GROUPS = [
  { id:'ise', title:'ISE · International School', note:'taught in English', programs:[
    { code:'ADME', name:'Automotive Design and Manufacturing Engineering' },
    { code:'AERO', name:'Aerospace Engineering' },
    { code:'ChPE', name:'Chemical and Process Engineering' },
    { code:'ICE',  name:'Information and Communication Engineering' },
    { code:'NANO', name:'Nano Engineering' },
    { code:'RAI',  name:'Robotics and Artificial Intelligence Engineering' },
    { code:'SEMI', name:'Semiconductor Engineering' },
  ]},
  { id:'regular', title:'Regular programs', note:'Thai programs', programs:[
    { code:'AUTO', name:'Automotive Engineering' },
    { code:'CHE',  name:'Chemical Engineering' },
    { code:'CE',   name:'Civil Engineering' },
    { code:'CP',   name:'Computer Engineering' },
    { code:'CEDT', name:'Computer Engineering and Digital Technology' },
    { code:'EE',   name:'Electrical Engineering' },
    { code:'ENV',  name:'Environmental Engineering' },
    { code:'GEO',  name:'Georesources Engineering' },
    { code:'IE',   name:'Industrial Engineering' },
    { code:'ME',   name:'Mechanical Engineering' },
    { code:'MT',   name:'Metallurgical Engineering' },
    { code:'MP',   name:'Mining and Petroleum Engineering' },
    { code:'NRE',  name:'Nuclear and Radiological Engineering' },
    { code:'SV',   name:'Survey Engineering' },
  ]},
]

export const PROGRAMS = PROGRAM_GROUPS.flatMap(g => g.programs.map(p => ({ ...p, group:g.id })))   // 21

export const OTHER_FACULTIES = ['Agricultural Resources (School)','Allied Health Sciences','Architecture','Arts','Commerce and Accountancy','Communication Arts','Dentistry','Economics','Education','Fine and Applied Arts','Integrated Innovation (School)','Law','Medicine','Nursing','Pharmaceutical Sciences','Political Science','Psychology','Science','Sports Science','Veterinary Science']

// Exact (case-sensitive) code match, or null.
export function programByCode(code) {
  return PROGRAMS.find(p => p.code === code) ?? null
}

// The full name for a known code; free-text programs come back as typed, and nothing gives ''.
export function programLabel(code) {
  if (code == null || code === '') return ''
  return programByCode(code)?.name ?? String(code)
}

// PROGRAM_GROUPS narrowed to programs whose code or name contains the query
// (case-insensitive). Groups left with no programs are dropped.
export function searchPrograms(query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return PROGRAM_GROUPS
  return PROGRAM_GROUPS
    .map(g => ({ ...g, programs:g.programs.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) }))
    .filter(g => g.programs.length)
}
