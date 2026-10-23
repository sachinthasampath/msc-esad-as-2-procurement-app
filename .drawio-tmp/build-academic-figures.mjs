import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const outDir = 'C:/Users/Sachintha Sampath/Desktop/ESAD-AS-2/walkthrough-figures/drawio'
const specDir = 'C:/Users/Sachintha Sampath/Desktop/ESAD-AS-2/app/.drawio-tmp/specs'

function yamlScalar(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = String(value)
  if (text === '') return '""'
  if (/[:#{}[\],&*!|>'"%@`]|^\s|\s$|\n/.test(text) || /^(true|false|null|yes|no)$/i.test(text)) {
    return JSON.stringify(text)
  }
  return text
}

function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`
    return value
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const body = toYaml(item, indent + 1)
          const lines = body.split('\n')
          return `${pad}- ${lines[0].trimStart()}\n${lines.slice(1).join('\n')}`.replace(/\n$/, '')
        }
        return `${pad}- ${yamlScalar(item)}`
      })
      .join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        if (Array.isArray(item)) {
          if (item.length === 0) return `${pad}${key}: []`
          return `${pad}${key}:\n${toYaml(item, indent + 1)}`
        }
        if (item && typeof item === 'object') {
          return `${pad}${key}:\n${toYaml(item, indent + 1)}`
        }
        return `${pad}${key}: ${yamlScalar(item)}`
      })
      .join('\n')
  }
  return `${pad}${yamlScalar(value)}`
}

function writeSpec(name, spec) {
  mkdirSync(specDir, { recursive: true })
  const path = join(specDir, `${name}.yaml`)
  writeFileSync(path, `${toYaml(spec)}\n`, 'utf8')
  return path
}

const replication = {
  colorMode: 'theme-first',
  background: '#FFFFFF',
  palette: [
    { hex: '#FFFFFF', role: 'canvas and node fill', appliesTo: 'nodes', confidence: 'high' },
    { hex: '#1E1E1E', role: 'strokes, text, and arrows', appliesTo: 'mixed', confidence: 'high' }
  ],
  confidenceNotes: [
    'Source sketches are black on white. Notation was normalized to UML academic conventions: dashed lifelines, filled synchronous arrows, open return arrows, hollow generalization triangles, and compartmented classes.'
  ]
}

function baseMeta(extra) {
  return {
    profile: 'academic-paper',
    theme: 'academic',
    source: 'replicated',
    layout: 'horizontal',
    routing: 'orthogonal',
    font: { primary: 'Times New Roman', cjk: 'Times New Roman,SimSun', formula: 'Times New Roman' },
    replication,
    ...extra
  }
}

const headStyle = {
  fontSize: 13,
  fontWeight: 700,
  align: 'center',
  verticalAlign: 'middle',
  fillColor: '#FFFFFF',
  strokeColor: '#1E1E1E',
  strokeWidth: 1.25,
  fontColor: '#1E1E1E'
}

const anchorStyle = {
  fontSize: 12,
  fontColor: '#FFFFFF',
  align: 'center',
  verticalAlign: 'middle'
}

const syncStyle = {
  strokeColor: '#1E1E1E',
  strokeWidth: 1.25,
  endArrow: 'block',
  endFill: true,
  endSize: 8,
  fontSize: 11,
  fontColor: '#1E1E1E'
}

const returnStyle = {
  ...syncStyle,
  dashed: true,
  dashPattern: '6 4',
  endArrow: 'open',
  endFill: false,
  endSize: 10
}

const lifeStyle = {
  strokeColor: '#1E1E1E',
  strokeWidth: 1,
  dashed: true,
  dashPattern: '2 3',
  endArrow: 'none',
  endFill: false,
  fontSize: 11
}

function sequenceSpec({ title, description, legend, canvas, actors, messages, selfLoops = [] }) {
  const nodes = []
  const edges = []
  const pitch = actors.length
  for (const actor of actors) {
    nodes.push({
      id: actor.id,
      label: actor.label,
      type: 'process',
      bounds: { x: actor.x, y: 24, width: actor.w, height: 48 },
      style: headStyle
    })
    nodes.push({
      id: `${actor.id}_foot`,
      label: '.',
      type: 'text',
      bounds: { x: actor.cx - 9, y: actor.footY, width: 18, height: 26 },
      style: anchorStyle
    })
    edges.push({
      from: actor.id,
      to: `${actor.id}_foot`,
      type: 'primary',
      style: {
        ...lifeStyle,
        exitX: 0.5,
        exitY: 1,
        entryX: 0.5,
        entryY: 0
      }
    })
  }
  const actorById = Object.fromEntries(actors.map((actor) => [actor.id, actor]))
  const used = new Set()
  function anchor(actorId, y, suffix) {
    const actor = actorById[actorId]
    const id = `${actorId}_y${suffix}`
    if (!used.has(id)) {
      used.add(id)
      nodes.push({
        id,
        label: '.',
        type: 'text',
        bounds: { x: actor.cx - 9, y: y - 13, width: 18, height: 26 },
        style: anchorStyle
      })
    }
    return id
  }
  messages.forEach((message, index) => {
    const y = message.y
    const source = anchor(message.from, y, `${index}_${message.from}`)
    const target = anchor(message.to, y, `${index}_${message.to}`)
    const leftToRight = actorById[message.from].cx < actorById[message.to].cx
    edges.push({
      from: source,
      to: target,
      type: 'primary',
      label: message.label,
      labelPosition: 'center',
      labelOffset: { x: 0, y: -14 },
      style: {
        ...(message.reply ? returnStyle : syncStyle),
        exitX: leftToRight ? 1 : 0,
        exitY: 0.5,
        entryX: leftToRight ? 0 : 1,
        entryY: 0.5
      }
    })
  })
  for (const loop of selfLoops) {
    const actor = actorById[loop.actor]
    const top = anchor(loop.actor, loop.y, `self_top_${loop.actor}`)
    const bottomId = `${loop.actor}_self_bot`
    nodes.push({
      id: bottomId,
      label: '.',
      type: 'text',
      bounds: { x: actor.cx - 9, y: loop.y + 27, width: 18, height: 26 },
      style: anchorStyle
    })
    edges.push({
      from: top,
      to: bottomId,
      type: 'primary',
      label: loop.label,
      labelPosition: 'center',
      labelOffset: { x: 78, y: -16 },
      style: syncStyle,
      waypoints: [
        { x: actor.cx + 88, y: loop.y },
        { x: actor.cx + 88, y: loop.y + 40 }
      ]
    })
  }
  return {
    meta: baseMeta({
      figureType: 'workflow',
      title,
      description,
    legend,
    canvas,
    print: { widthPt: 1320, minPt: 8 }
  }),
    nodes,
    edges,
    modules: []
  }
}

function actors(labels, footY) {
  const width = 176
  const pitch = 400
  const origin = 40
  return labels.map((label, index) => {
    const x = origin + index * pitch
    return {
      id: ['a', 'b', 'c', 'd', 'e'][index],
      label,
      x,
      w: width,
      cx: x + width / 2,
      footY
    }
  })
}

const approvalActors = actors(['Manager', 'ProcureX', 'API / services', 'Workflow', 'Factory'], 760)
const approvalMessages = [
  ['1. Open Requisitions queue', 0, 1],
  ['2. GET /requisitions?status=WAITING_APPROVAL', 1, 2],
  ['3. Approve / partial / decline / return / refer', 0, 1],
  ['4. POST /requisitions/{id}/decide', 1, 2],
  ['5. RequisitionWorkflow (budget check)', 2, 3],
  ['6. if approved: PurchaseOrderFactory.split', 3, 4],
  ['7. one PO per supplier, status PLACED', 4, 2, true],
  ['8. Observer: return notice if returned', 3, 2],
  ['9. new status and PO numbers', 2, 1, true]
].map(([label, from, to, reply], index) => ({
  label,
  from: approvalActors[from].id,
  to: approvalActors[to].id,
  y: 120 + index * 68,
  reply: Boolean(reply)
}))

const createActors = actors(['Site manager', 'SiteFlow', 'API / services', 'Workflow', 'Strategy'], 860)
const createRows = [
  ['1. Open New Purchase Order sheet', 0, 1],
  ['2. POST /requisitions (draft)', 1, 2],
  ['3. Submit (online only)', 0, 1],
  ['4. POST /requisitions/{id}/submit', 1, 2],
  ['5. RequisitionWorkflow.submit', 2, 3],
  null,
  ['7. selectApprovalStrategy(total, policy) apply', 3, 4],
  ['8. APPROVED / WAITING_APPROVAL / REFERRED', 4, 3, true],
  ['9. saved status returned', 2, 1, true],
  ['10. Orders list shows new status', 1, 0, true]
]
let createY = 120
const createMessages = []
let selfY = 0
for (const row of createRows) {
  if (row == null) {
    selfY = createY
    createY += 88
    continue
  }
  const [label, from, to, reply] = row
  createMessages.push({
    label,
    from: createActors[from].id,
    to: createActors[to].id,
    y: createY,
    reply: Boolean(reply)
  })
  createY += 68
}

const invoiceActors = actors(['Procurement', 'ProcureX', 'API / services', 'Invoice', 'Match chain'], 700)
const invoiceMessages = [
  ['1. Enter invoice against a PO', 0, 1],
  ['2. POST /invoices', 1, 2],
  ['3. Invoice.performThreeWayMatch', 2, 3],
  ['4. NotDelivered -> Full -> Partial -> Price', 3, 4],
  ['5. MatchResult', 4, 3, true],
  ['6. Approve, hold, or raise credit note', 0, 1],
  ['7. POST /invoices/{id}/pay (if approved)', 1, 2],
  ['8. releasePayment, lock the PO', 2, 3]
].map(([label, from, to, reply], index) => ({
  label,
  from: invoiceActors[from].id,
  to: invoiceActors[to].id,
  y: 120 + index * 68,
  reply: Boolean(reply)
}))

const deliveryActors = actors(['Site manager', 'SiteFlow', 'API / services', 'PurchaseOrder', 'PO state'], 700)
const deliveryMessages = [
  ['1. Open Deliveries, pick a placed PO', 0, 1],
  ['2. Enter qty, Accepted or Damaged (+ photo)', 0, 1],
  ['3. POST /purchase-orders/{id}/deliveries', 1, 2],
  ['4. PurchaseOrder.receive', 2, 3],
  ['5. assertCanReceive + advance', 3, 4],
  ['6. PARTIALLY_DELIVERED or FULLY_DELIVERED', 4, 3, true],
  ['7. if fully delivered: PO_READY_FOR_INVOICE', 3, 2],
  ['8. updated progress on the card', 2, 1, true]
].map(([label, from, to, reply], index) => ({
  label,
  from: deliveryActors[from].id,
  to: deliveryActors[to].id,
  y: 120 + index * 68,
  reply: Boolean(reply)
}))

const seqLegend =
  'Filled arrow: synchronous message. Open dashed arrow: return. Vertical dashed line: lifeline.'

const specs = []

specs.push([
  '04-seq-approval',
  sequenceSpec({
    title: 'Approval and purchase-order split',
    description: 'Manager decision on a waiting requisition, then purchase-order creation when the decision approves it.',
    legend: seqLegend,
    canvas: '1880x840',
    actors: approvalActors,
    messages: approvalMessages
  })
])

specs.push([
  '03-seq-create',
  sequenceSpec({
    title: 'Create and submit a requisition',
    description: 'Site manager drafts and submits a requisition. Unpriced lines are held, then an approval strategy sets the next status.',
    legend: seqLegend,
    canvas: '1880x940',
    actors: createActors,
    messages: createMessages,
    selfLoops: [
      {
        actor: createActors[3].id,
        y: selfY,
        label: '6. unpriced? -> ON_HOLD'
      }
    ]
  })
])

specs.push([
  '06-seq-invoice',
  sequenceSpec({
    title: 'Invoice three-way match and payment',
    description: 'Procurement enters an invoice against a purchase order. The match chain checks delivery, quantity, and price before payment.',
    legend: seqLegend,
    canvas: '1880x780',
    actors: invoiceActors,
    messages: invoiceMessages
  })
])

specs.push([
  '05-seq-delivery',
  sequenceSpec({
    title: 'Record a delivery against a placed purchase order',
    description: 'The site manager records accepted or damaged quantities. The purchase order advances and, when complete, becomes ready for invoice.',
    legend: seqLegend,
    canvas: '1880x780',
    actors: deliveryActors,
    messages: deliveryMessages
  })
])

function cls(id, label, x, y, w, h) {
  return {
    id,
    label,
    type: 'process',
    bounds: { x, y, width: w, height: h },
    style: {
      fontSize: 12,
      align: 'left',
      verticalAlign: 'top',
      spacingLeft: 8,
      spacingTop: 6,
      spacingRight: 6,
      fillColor: '#FFFFFF',
      strokeColor: '#1E1E1E',
      strokeWidth: 1.25,
      fontColor: '#1E1E1E'
    }
  }
}

const classNodes = [
  cls(
    'user',
    'User (abstract)\n--------\nuserId\nname\nemail\ncontactNumber',
    48,
    16,
    1088,
    128
  ),
  cls('siteManager', 'SiteManager\n--------\nsiteId\n--------\ncreate requisition\nlog delivery', 62, 200, 220, 136),
  cls('procurement', 'ProcurementStaff\n--------\nprice catalogue\nenter invoice', 304, 200, 220, 136),
  cls(
    'management',
    'ManagementStaff\n--------\nlevel: OPERATIONAL | SENIOR\n--------\ndecide requisition',
    560,
    200,
    280,
    136
  ),
  cls('policy', 'ApprovalPolicy\n--------\nautoApproveLimit\nmanagerLimit', 880, 200, 220, 136),
  cls(
    'requisition',
    'Requisition\n--------\nrequisitionId\nstatus\ncomments\n--------\ncalculateTotalValue()\nvalidateBudget()\nhasUnpriced()',
    48,
    400,
    248,
    184
  ),
  cls(
    'reqLine',
    'RequisitionLine\n--------\nitem, supplier, depot, qty\nagreedPrice, approved\n--------\nisPriceValid()',
    360,
    400,
    248,
    184
  ),
  cls('account', 'Account\n--------\naccountName, costCenter\ncurrentBalance', 672, 400, 220, 184),
  cls('site', 'ConstructionSite\n--------\nsiteName, address\ncontactPerson', 952, 400, 220, 184),
  cls(
    'po',
    'PurchaseOrder\n--------\npoId, status, deliveryAddress\npaymentLocked\n--------\nreceive()',
    48,
    648,
    248,
    152
  ),
  cls('poLine', 'POLine\n--------\nqty, unitPrice\ncumulativeAcceptedQty', 360, 648, 248, 152),
  cls(
    'factory',
    'PurchaseOrderFactory\n--------\nsplit(requisition)\none PO per supplier+depot',
    672,
    648,
    248,
    152
  ),
  cls('supplier', 'Supplier\n--------\nname, address, taxId', 976, 648, 200, 96),
  cls('depot', 'Depot\n--------\nlocation, contactDetails', 976, 776, 200, 88),
  cls('delivery', 'DeliveryRecord\n--------\ndate, note, siteManager', 48, 864, 248, 112),
  cls('delLine', 'DeliveryLine\n--------\nqtyReceived, condition\nphotoUri if Damaged', 360, 864, 248, 112),
  cls('catalog', 'CatalogItem\n--------\ndescription, agreedPrice\n--------\nisPriced()', 672, 864, 248, 112),
  cls(
    'invoice',
    'Invoice\n--------\ninvoiceNo, amount, status\n--------\nperformThreeWayMatch()\napprove(), releasePayment()',
    40,
    1040,
    264,
    152
  ),
  cls('credit', 'CreditNote\n--------\nadjustmentAmount', 376, 1040, 200, 152),
  cls('payment', 'Payment\n--------\namount, method, paidAt', 640, 1040, 220, 152),
  cls(
    'workflow',
    'RequisitionWorkflow\n--------\nsubmit, decide, cancel, edit\nloads RequisitionState',
    920,
    1040,
    260,
    152
  )
]

function assoc(from, to, extra = {}) {
  return {
    from,
    to,
    type: 'primary',
    style: {
      strokeColor: '#1E1E1E',
      strokeWidth: 1.25,
      endArrow: 'none',
      endFill: false,
      fontSize: 12,
      fontColor: '#1E1E1E',
      ...extra
    }
  }
}

function vertical(from, to, arrow) {
  return assoc(from, to, {
    endArrow: arrow ? 'open' : 'none',
    endFill: false,
    endSize: 12,
    exitX: 0.5,
    exitY: 0,
    entryX: 0.5,
    entryY: 1
  })
}

function down(from, to, arrow) {
  return assoc(from, to, {
    endArrow: arrow ? 'open' : 'none',
    endFill: false,
    endSize: 12,
    exitX: 0.5,
    exitY: 1,
    entryX: 0.5,
    entryY: 0
  })
}

function right(from, to, arrow) {
  return assoc(from, to, {
    endArrow: arrow ? 'open' : 'none',
    endFill: false,
    endSize: 12,
    exitX: 1,
    exitY: 0.5,
    entryX: 0,
    entryY: 0.5
  })
}

const byId = Object.fromEntries(classNodes.map((node) => [node.id, node.bounds]))
function generalize(childId) {
  const child = byId[childId]
  const parent = byId.user
  const childCx = child.x + child.width / 2
  const entryX = Number(((childCx - parent.x) / parent.width).toFixed(4))
  return assoc(childId, 'user', {
    endArrow: 'block',
    endFill: false,
    endSize: 16,
    exitX: 0.5,
    exitY: 0,
    entryX,
    entryY: 1
  })
}

const classEdges = [
  generalize('siteManager'),
  generalize('procurement'),
  generalize('management'),
  generalize('policy'),
  vertical('requisition', 'siteManager', true),
  right('requisition', 'reqLine', false),
  right('reqLine', 'account', false),
  vertical('po', 'requisition', true),
  right('po', 'poLine', false),
  down('po', 'delivery', false),
  right('delivery', 'delLine', false),
  down('delivery', 'invoice', false),
  right('invoice', 'credit', false),
  right('credit', 'payment', true)
]

specs.push([
  '02-class-asbuilt',
  {
    meta: baseMeta({
      figureType: 'architecture',
      title: 'As-built class structure',
      description:
        'Classes and relationships for users, requisitions, purchase orders, deliveries, and invoices. ApprovalPolicy is shown as a subclass of User, matching the source sketch.',
      legend:
        'Hollow triangle: generalization. Open arrow: navigable association. Plain line: association.',
      canvas: '1240x1240'
    }),
    nodes: classNodes,
    edges: classEdges,
    modules: []
  }
])

function state(id, label, x, y, w = 168) {
  return {
    id,
    label,
    type: 'process',
    bounds: { x, y, width: w, height: 52 },
    style: {
      fontSize: 13,
      fontWeight: 600,
      align: 'center',
      verticalAlign: 'middle',
      fillColor: '#FFFFFF',
      strokeColor: '#1E1E1E',
      strokeWidth: 1.25,
      fontColor: '#1E1E1E'
    }
  }
}

const stateNodes = [
  state('draft', 'Draft', 32, 48, 150),
  state('hold', 'On hold', 280, 48, 150),
  state('waiting', 'Waiting approval', 528, 48, 180),
  state('referred', 'Referred', 808, 48, 160),
  state('approved', 'Approved', 32, 248, 150),
  state('partial', 'Partially approved', 264, 248, 182),
  state('declined', 'Declined', 543, 248, 150),
  state('returned', 'Returned', 808, 248, 160),
  state('cancelled', 'Cancelled', 808, 400, 160),
  state('placed', 'Placed', 32, 560, 150),
  state('partDel', 'Partially delivered', 280, 560, 190),
  state('fullDel', 'Fully delivered', 568, 560, 176)
]

function trans(from, to, label, points, dashed = false) {
  const edge = {
    from,
    to,
    type: 'primary',
    style: {
      strokeColor: '#1E1E1E',
      strokeWidth: 1.25,
      endArrow: 'open',
      endFill: false,
      endSize: 10,
      fontSize: 12,
      fontColor: '#1E1E1E',
      ...(dashed ? { dashed: true, dashPattern: '6 4' } : {})
    }
  }
  if (label) {
    edge.label = label
    edge.labelPosition = 'center'
    edge.labelOffset = { x: 0, y: -14 }
  }
  if (points) {
    if (points.exit) Object.assign(edge.style, points.exit)
    if (points.waypoints) edge.waypoints = points.waypoints
  } else {
    Object.assign(edge.style, { exitX: 0.5, exitY: 0.5, entryX: 0.5, entryY: 0.5 })
  }
  return edge
}

function hTrans(from, to, label) {
  return trans(from, to, label, {
    exit: { exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5 }
  })
}

function vTrans(from, to, label, offsetX = 16) {
  const edge = trans(from, to, label, {
    exit: { exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0 }
  })
  if (label) edge.labelOffset = { x: offsetX, y: 0 }
  return edge
}

const stateEdges = [
  hTrans('draft', 'hold', 'unpriced submit'),
  hTrans('hold', 'waiting', 'manager band'),
  hTrans('waiting', 'referred', null),
  vTrans('draft', 'approved', 'auto-approve', 64),
  vTrans('hold', 'partial', null),
  vTrans('waiting', 'declined', 'decline', 78),
  vTrans('referred', 'returned', 'above limit', 58),
  vTrans('returned', 'cancelled', null),
  trans('waiting', 'returned', 'return', {
    waypoints: [
      { x: 700, y: 128 },
      { x: 760, y: 128 },
      { x: 760, y: 176 },
      { x: 888, y: 176 }
    ]
  }),
  trans('waiting', 'draft', 'edit -> Draft', {
    waypoints: [
      { x: 618, y: 16 },
      { x: 107, y: 16 }
    ]
  }, true),
  trans('waiting', 'partial', 'approve', {
    waypoints: [
      { x: 560, y: 128 },
      { x: 560, y: 188 },
      { x: 430, y: 188 }
    ]
  }, true),
  hTrans('placed', 'partDel', 'short receipt'),
  hTrans('partDel', 'fullDel', 'covers order')
]

stateEdges.find((edge) => edge.label === 'return').labelOffset = { x: 16, y: -20 }

specs.push([
  '07-state',
  {
    meta: baseMeta({
      figureType: 'workflow',
      title: 'Requisition and purchase-order states',
      description:
        'Requisition states from draft through approval, and purchase-order states from placed through delivery. Dashed arrows are the edit and approve transitions drawn dashed in the source.',
      legend: 'Open arrow: state transition. Dashed open arrow: edit and approve transitions from the source sketch.',
      canvas: '1040x660'
    }),
    nodes: stateNodes,
    edges: stateEdges,
    modules: []
  }
])

for (const [name, spec] of specs) {
  const path = writeSpec(name, spec)
  console.log(path)
}
