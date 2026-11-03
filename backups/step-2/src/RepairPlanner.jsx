import { useState } from 'react'
import { TECHS } from './data.js'
import { askAI, AI_LABEL } from './ai.js'

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

// The agent drafts a work order, reserves parts and tools, and the technician sends it.
export default function RepairPlanner({ robot, assessment, order, onSend }) {
  const [plan, setPlan] = useState(order ? order.plan : null)
  const [loading, setLoading] = useState(false)
  const [techId, setTechId] = useState(order ? order.techId : '')
  const [error, setError] = useState('')

  async function prepare() {
    setLoading(true)
    setError('')
    const res = await askAI({ task: 'plan_repair', robot, assessment })
    setLoading(false)
    if (res.error) setError(res.error)
    else setPlan(res)
  }

  function send() {
    if (!techId) {
      setError('Please choose a technician before sending. The agent’s suggestion is shown above the list.')
      return
    }
    setError('')
    onSend({ plan, techId })
  }

  if (!plan) {
    return (
      <div className="repair">
        <button type="button" className="primary-btn" onClick={prepare} disabled={loading}>
          {loading ? 'Agent is preparing the repair…' : 'Have the agent prepare this repair'}
        </button>
        {loading && <p className="thinking">Checking line stops, the tool crib and who is on shift…</p>}
        {error && <p className="error-msg">{error}</p>}
      </div>
    )
  }

  const tech = TECHS.find((t) => t.id === techId)
  const suggested = TECHS.find((t) => t.id === plan.suggestedTechId)

  return (
    <div className={`repair work-order ${order ? 'sent' : ''}`}>
      <div className="ai-panel-head">
        <h3>
          {plan.workOrder} <span className="wo-status">{order ? 'Sent' : 'Draft'}</span>
        </h3>
        <span className="ai-badge">{AI_LABEL}</span>
      </div>
      <p className="wo-title">{plan.title}</p>

      <dl className="facts">
        <div>
          <dt>Do it during</dt>
          <dd>{plan.window}</dd>
        </div>
        <div>
          <dt>Must be fixed within</dt>
          <dd>{plan.deadline}</dd>
        </div>
        <div>
          <dt>Repair time</dt>
          <dd>{plan.plannedHours} hr planned</dd>
        </div>
      </dl>
      <p className="window-note">{plan.windowNote}</p>

      <div className="cost-compare">
        <div className="cost planned">
          <span className="cost-num">{money(plan.plannedCost)}</span>
          <span>line downtime if fixed now</span>
        </div>
        <div className="cost unplanned">
          <span className="cost-num">{money(plan.unplannedCost)}</span>
          <span>if it breaks on its own ({plan.unplannedHours} hrs)</span>
        </div>
      </div>

      <h4>Steps</h4>
      <ol className="steps">
        {plan.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h4>
        Parts and tools{' '}
        <span className="muted-inline">
          {plan.missingCount === 0 ? '· all reserved' : `· ${plan.missingCount} need attention`}
        </span>
      </h4>
      <ul className="items">
        {plan.items.map((item) => (
          <li key={item.name} className={`item ${item.status}`}>
            <span className="item-icon" aria-hidden="true">
              {item.status === 'reserved' ? '✔' : '!'}
            </span>
            <span>
              <strong>{item.name}</strong> <span className="item-kind">{item.kind}</span>
              <br />
              <span className="item-note">{item.note}</span>
            </span>
          </li>
        ))}
      </ul>

      {order ? (
        <p className="success-msg">
          ✔ Sent to {tech ? tech.label.split(' · ')[0] : 'the technician'}. Parts and tools are held in the crib for this job.
        </p>
      ) : (
        <>
          <h4>Assign a technician</h4>
          {suggested && (
            <p className="suggestion">
              Agent suggests <strong>{suggested.label.split(' · ')[0]}</strong>: {plan.suggestedReason}{' '}
              <button type="button" className="link-btn" onClick={() => setTechId(suggested.id)}>
                Use suggestion
              </button>
            </p>
          )}
          <label className="field">
            <span className="sr-only">Technician</span>
            <select value={techId} onChange={(e) => setTechId(e.target.value)}>
              <option value="">Choose a technician…</option>
              {TECHS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="error-msg">{error}</p>}
          <button type="button" className="primary-btn" onClick={send}>
            Send work order
          </button>
        </>
      )}
    </div>
  )
}
