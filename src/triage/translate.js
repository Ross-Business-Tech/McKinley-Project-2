// Work orders in the technician's own language.
// The fixed parts (job type, priority, entry rules, pet and vendor notes) are translated here
// ahead of time, so they work offline and never change meaning. The resident's own words can't be
// translated without a translation service, so we link to Google Translate for that part.
// Have a bilingual staff member check these phrases before real use.

export const LANGS = [
  { code: 'en', name: 'English', native: 'English', full: true },
  { code: 'es', name: 'Spanish', native: 'Español', full: true },
  { code: 'pt', name: 'Portuguese', native: 'Português', full: true },
  { code: 'fr', name: 'French', native: 'Français', full: true },
  { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl ayisyen', full: true },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', full: false },
  { code: 'ar', name: 'Arabic', native: 'العربية', full: false },
  { code: 'zh-CN', name: 'Chinese', native: '中文', full: false },
  { code: 'pl', name: 'Polish', native: 'Polski', full: false },
  { code: 'ru', name: 'Russian', native: 'Русский', full: false },
]
export const langInfo = (code) => LANGS.find((l) => l.code === code)

const T = {
  en: {
    title: 'Work order', property: 'Property', building: 'Building', unit: 'Unit', address: 'Address', priority: 'Priority',
    entry: 'Entry', bring: 'Bring', message: "Resident's message", assigned: 'Assigned to',
    sev: { 5: 'Emergency', 4: 'Urgent', 3: 'Soon', 2: 'Routine', 1: 'Cosmetic' },
    sla: { 5: 'Go now', 4: 'Same day', 3: 'Within 48 hours', 2: 'Within a week', 1: 'When convenient' },
    entryText: {
      emergency: 'Emergency: you may enter without advance notice. Knock and call first; leave a note after.',
      ok: 'OK to enter. Text the resident before you arrive.',
      lockout: 'The resident is there to let you in. Check their ID before opening the door.',
      hold: "Do NOT enter yet: waiting for the resident's permission.",
      none: 'No apartment entry needed.',
      unknown: 'Unit not confirmed. Check with the office before going.',
    },
    pet: 'Pet in the unit ({pet}). Ask the resident to secure it and keep the door closed.',
    vendor: 'May need an outside vendor. Do a first look only.',
    animals: { dog: 'dog', cat: 'cat' },
  },
  es: {
    title: 'Orden de trabajo', property: 'Propiedad', building: 'Edificio', unit: 'Unidad', address: 'Dirección', priority: 'Prioridad',
    entry: 'Entrada', bring: 'Llevar', message: 'Mensaje del residente', assigned: 'Asignado a',
    sev: { 5: 'Emergencia', 4: 'Urgente', 3: 'Pronto', 2: 'Rutina', 1: 'Estético' },
    sla: { 5: 'Ir ahora', 4: 'Hoy mismo', 3: 'Dentro de 48 horas', 2: 'Dentro de una semana', 1: 'Cuando sea conveniente' },
    entryText: {
      emergency: 'Emergencia: puede entrar sin aviso previo. Toque la puerta y llame primero; deje una nota después.',
      ok: 'Puede entrar. Envíe un mensaje al residente antes de llegar.',
      lockout: 'El residente está allí para dejarle entrar. Verifique su identificación antes de abrir la puerta.',
      hold: 'NO entre todavía: esperando el permiso del residente.',
      none: 'No es necesario entrar al apartamento.',
      unknown: 'Unidad no confirmada. Consulte con la oficina antes de ir.',
    },
    pet: 'Hay una mascota en la unidad ({pet}). Pida al residente que la asegure y mantenga la puerta cerrada.',
    vendor: 'Puede necesitar un proveedor externo. Solo haga una primera revisión.',
    animals: { dog: 'perro', cat: 'gato' },
  },
  pt: {
    title: 'Ordem de serviço', property: 'Propriedade', building: 'Prédio', unit: 'Unidade', address: 'Endereço', priority: 'Prioridade',
    entry: 'Entrada', bring: 'Levar', message: 'Mensagem do morador', assigned: 'Atribuído a',
    sev: { 5: 'Emergência', 4: 'Urgente', 3: 'Em breve', 2: 'Rotina', 1: 'Estético' },
    sla: { 5: 'Ir agora', 4: 'No mesmo dia', 3: 'Em até 48 horas', 2: 'Em até uma semana', 1: 'Quando for conveniente' },
    entryText: {
      emergency: 'Emergência: pode entrar sem aviso prévio. Bata na porta e ligue antes; deixe um bilhete depois.',
      ok: 'Pode entrar. Mande uma mensagem ao morador antes de chegar.',
      lockout: 'O morador está lá para deixar você entrar. Confira o documento de identidade antes de abrir a porta.',
      hold: 'NÃO entre ainda: aguardando a permissão do morador.',
      none: 'Não é preciso entrar no apartamento.',
      unknown: 'Unidade não confirmada. Confirme com o escritório antes de ir.',
    },
    pet: 'Há um animal de estimação na unidade ({pet}). Peça ao morador para prendê-lo e mantenha a porta fechada.',
    vendor: 'Pode precisar de um fornecedor externo. Faça só uma primeira avaliação.',
    animals: { dog: 'cachorro', cat: 'gato' },
  },
  fr: {
    title: 'Bon de travail', property: 'Résidence', building: 'Bâtiment', unit: 'Logement', address: 'Adresse', priority: 'Priorité',
    entry: 'Entrée', bring: 'À apporter', message: 'Message du résident', assigned: 'Assigné à',
    sev: { 5: 'Urgence', 4: 'Urgent', 3: 'Bientôt', 2: 'Routine', 1: 'Esthétique' },
    sla: { 5: 'Y aller maintenant', 4: "Aujourd'hui", 3: 'Sous 48 heures', 2: 'Sous une semaine', 1: 'Quand c’est pratique' },
    entryText: {
      emergency: "Urgence : vous pouvez entrer sans préavis. Frappez et appelez d'abord ; laissez un mot après.",
      ok: "Entrée autorisée. Envoyez un SMS au résident avant d'arriver.",
      lockout: "Le résident est sur place pour vous laisser entrer. Vérifiez sa pièce d'identité avant d'ouvrir la porte.",
      hold: "N'entrez PAS encore : en attente de l'autorisation du résident.",
      none: "Pas besoin d'entrer dans le logement.",
      unknown: "Logement non confirmé. Vérifiez avec le bureau avant d'y aller.",
    },
    pet: "Animal dans le logement ({pet}). Demandez au résident de l'enfermer et gardez la porte fermée.",
    vendor: 'Peut nécessiter un prestataire externe. Faites seulement un premier diagnostic.',
    animals: { dog: 'chien', cat: 'chat' },
  },
  ht: {
    title: 'Lòd travay', property: 'Pwopriyete', building: 'Bilding', unit: 'Inite', address: 'Adrès', priority: 'Priyorite',
    entry: 'Antre', bring: 'Pote', message: 'Mesaj rezidan an', assigned: 'Bay',
    sev: { 5: 'Ijans', 4: 'Ijan', 3: 'Talè', 2: 'Woutin', 1: 'Estetik' },
    sla: { 5: 'Ale kounye a', 4: 'Jodi a menm', 3: 'Nan 48 è', 2: 'Nan yon semèn', 1: 'Lè li bon pou ou' },
    entryText: {
      emergency: 'Ijans: ou ka antre san avètisman. Frape pòt la epi rele anvan; kite yon nòt apre.',
      ok: 'Ou ka antre. Voye yon tèks bay rezidan an anvan ou rive.',
      lockout: 'Rezidan an la pou l kite w antre. Verifye kat idantite li anvan ou louvri pòt la.',
      hold: 'PA antre toujou: n ap tann pèmisyon rezidan an.',
      none: 'Pa bezwen antre nan apatman an.',
      unknown: 'Inite a pa konfime. Tcheke ak biwo a anvan ou ale.',
    },
    pet: 'Gen yon bèt nan inite a ({pet}). Mande rezidan an pou l fèmen l, epi kenbe pòt la fèmen.',
    vendor: 'Li ka bezwen yon konpayi deyò. Fè yon premye gade sèlman.',
    animals: { dog: 'chen', cat: 'chat' },
  },
}

const JOBS = {
  es: { gas: 'Olor a gas / fuga de gas', fire: 'Humo / fuego / olor a quemado', flood: 'Inundación / tubería rota', sewage: 'Desbordamiento de aguas negras', sparks: 'Chispas / peligro eléctrico', noheat: 'Sin calefacción', noac: 'Sin aire acondicionado / no enfría', lockout: 'Residente sin poder entrar / cerradura rota', nohotwater: 'Sin agua caliente', fridge: 'El refrigerador no funciona', leak: 'Fuga / goteo', toilet: 'Problema con el inodoro', appliance: 'Problema con un electrodoméstico', pest: 'Plagas', electrical: 'Enchufe / luz / interruptor automático', door: 'Puerta / ventana / gabinete', amenity: 'Área común', cosmetic: 'Estético', other: 'Otro / no está claro' },
  pt: { gas: 'Cheiro de gás / vazamento de gás', fire: 'Fumaça / fogo / cheiro de queimado', flood: 'Inundação / cano estourado', sewage: 'Retorno de esgoto', sparks: 'Faíscas / perigo elétrico', noheat: 'Sem aquecimento', noac: 'Sem ar-condicionado / não resfria', lockout: 'Morador trancado do lado de fora / fechadura quebrada', nohotwater: 'Sem água quente', fridge: 'Geladeira não funciona', leak: 'Vazamento / gotejamento', toilet: 'Problema no vaso sanitário', appliance: 'Problema com eletrodoméstico', pest: 'Pragas', electrical: 'Tomada / luz / disjuntor', door: 'Porta / janela / armário', amenity: 'Área comum', cosmetic: 'Estético', other: 'Outro / não está claro' },
  fr: { gas: 'Odeur de gaz / fuite de gaz', fire: 'Fumée / feu / odeur de brûlé', flood: 'Inondation / tuyau éclaté', sewage: "Refoulement d'égout", sparks: 'Étincelles / danger électrique', noheat: 'Pas de chauffage', noac: 'Pas de climatisation / ne refroidit pas', lockout: 'Résident bloqué dehors / serrure cassée', nohotwater: "Pas d'eau chaude", fridge: 'Réfrigérateur en panne', leak: 'Fuite / goutte-à-goutte', toilet: 'Problème de toilettes', appliance: "Problème d'électroménager", pest: 'Nuisibles', electrical: 'Prise / lumière / disjoncteur', door: 'Porte / fenêtre / placard', amenity: 'Espace commun', cosmetic: 'Esthétique', other: 'Autre / pas clair' },
  ht: { gas: 'Sant gaz / fwit gaz', fire: 'Lafimen / dife / sant boule', flood: 'Inondasyon / tiyo pete', sewage: 'Dlo egou ap remonte', sparks: 'Etensèl / danje elektrik', noheat: 'Pa gen chofaj', noac: 'Pa gen èkondisyone / li pa fè frèt', lockout: 'Rezidan an bloke deyò / seri kase', nohotwater: 'Pa gen dlo cho', fridge: 'Frijidè a pa mache', leak: 'Fwit / dlo k ap degoute', toilet: 'Pwoblèm twalèt', appliance: 'Pwoblèm aparèy kay', pest: 'Ensèk / rat', electrical: 'Priz / limyè / disjonktè', door: 'Pòt / fenèt / kabinè', amenity: 'Zòn komen', cosmetic: 'Estetik', other: 'Lòt / pa klè' },
}

// Words on the technician's screen.
const UI = {
 "en": {
  "myDay": "My day",
  "stop": "Stop",
  "arrive": "Arrive about",
  "directions": "Directions",
  "call": "Call resident",
  "done": "Done",
  "finished": "Finished",
  "none": "No approved jobs for you yet.",
  "waiting": "{n} more waiting for the manager to approve",
  "photos": "Photos",
  "addPhoto": "Add photo",
  "translateMsg": "Translate message",
  "iam": "I am"
 },
 "es": {
  "myDay": "Mi día",
  "stop": "Parada",
  "arrive": "Llegar aprox.",
  "directions": "Cómo llegar",
  "call": "Llamar al residente",
  "done": "Terminado",
  "finished": "Terminado",
  "none": "Todavía no tiene trabajos aprobados.",
  "waiting": "{n} más esperando la aprobación del gerente",
  "photos": "Fotos",
  "addPhoto": "Agregar foto",
  "translateMsg": "Traducir mensaje",
  "iam": "Soy"
 },
 "pt": {
  "myDay": "Meu dia",
  "stop": "Parada",
  "arrive": "Chegar por volta de",
  "directions": "Rota",
  "call": "Ligar para o morador",
  "done": "Concluído",
  "finished": "Concluído",
  "none": "Você ainda não tem serviços aprovados.",
  "waiting": "{n} aguardando a aprovação do gerente",
  "photos": "Fotos",
  "addPhoto": "Adicionar foto",
  "translateMsg": "Traduzir mensagem",
  "iam": "Eu sou"
 },
 "fr": {
  "myDay": "Ma journée",
  "stop": "Arrêt",
  "arrive": "Arrivée vers",
  "directions": "Itinéraire",
  "call": "Appeler le résident",
  "done": "Terminé",
  "finished": "Terminé",
  "none": "Vous n'avez pas encore de travaux approuvés.",
  "waiting": "{n} en attente d'approbation du responsable",
  "photos": "Photos",
  "addPhoto": "Ajouter une photo",
  "translateMsg": "Traduire le message",
  "iam": "Je suis"
 },
 "ht": {
  "myDay": "Jounen mwen",
  "stop": "Arè",
  "arrive": "Rive anviwon",
  "directions": "Direksyon",
  "call": "Rele rezidan an",
  "done": "Fini",
  "finished": "Fini",
  "none": "Ou poko gen travay ki apwouve.",
  "waiting": "{n} ap tann apwobasyon manadjè a",
  "photos": "Foto",
  "addPhoto": "Ajoute foto",
  "translateMsg": "Tradui mesaj la",
  "iam": "Mwen se"
 }
}
export const uiText = (code) => UI[code] || UI.en

export const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')

// Builds the work order the technician sees. Returns lines for the screen and plain text for a text message.
export function workTicket(o, tech, address) {
  const code = tech.lang || 'en'
  const info = langInfo(code) || LANGS[0]
  const d = info.full ? T[code] : T.en
  const label = info.full && code !== 'en' ? JOBS[code][o.type] : o.label
  const bld = o.resident?.building || o.loc?.building
  const unit = o.resident?.unit || o.loc?.unit
  const entryKey = !o.resident ? 'unknown' : o.type === 'lockout' ? 'lockout' : o.entry.status
  let pet = o.resident?.pets
  if (pet) {
    const [kind, name] = pet.split(' - ')
    pet = `${d.animals[kind] || kind}${name ? ` - ${name}` : ''}`
  }
  const lines = [
    [d.title, `${o.id} · ${label}`],
    [d.priority, `${o.sev} · ${d.sev[o.sev]} · ${d.sla[o.sev]}`],
    [d.property, o.community || '?'],
    ...(bld ? [[d.building, bld]] : []),
    ...(unit ? [[d.unit, unit]] : []),
    ...(address ? [[d.address, address]] : []),
    [d.entry, d.entryText[entryKey] || d.entryText.ok],
    ...(pet && o.entry.status !== 'none' ? [['🐾', fill(d.pet, { pet })]] : []),
    ...(o.vendor ? [['⚑', d.vendor]] : []),
    [d.bring, o.bring.join(', ')],
    [d.message, `“${o.text}”`],
  ]
  const text = lines.map(([k, v]) => `${k}: ${v}`).join('\n')
  const gt = (s) => `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(code)}&text=${encodeURIComponent(s)}&op=translate`
  return {
    lang: info,
    lines,
    text,
    // Full languages: only the resident's own words need a translator. Others: translate the whole work order.
    translateUrl: code === 'en' ? null : info.full ? gt(o.text) : gt(text),
  }
}
