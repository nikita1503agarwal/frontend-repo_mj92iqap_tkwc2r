import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function App() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [requirements, setRequirements] = useState([])
  const [newReq, setNewReq] = useState({ type: 'hardware', subtype: '', details: {} })
  const [message, setMessage] = useState('')

  // Role selection instead of email/password
  const roles = [
    { key: 'client', label: 'Client' },
    { key: 'ae', label: 'AE' },
    { key: 'verifier', label: 'Verifier' },
    { key: 'admin', label: 'Admin' },
  ]

  async function seedSamples(tok) {
    try {
      const res = await fetch(`${API}/debug/seed-samples`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) {
        // don't block sign-in if seeding fails
        const t = await res.text()
        console.warn('Seeding failed:', t)
        return
      }
      return await res.json()
    } catch (e) {
      console.warn('Seeding error', e)
    }
  }

  async function impersonate(role) {
    try {
      const res = await fetch(`${API}/auth/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to sign in')
      }
      const data = await res.json()
      setToken(data.access_token)
      setUser(data.user)
      setMessage('')
      // Seed role-relevant demo data, then preload lists
      await seedSamples(data.access_token)
      loadMyRequirements(data.access_token)
    } catch (e) {
      setMessage(String(e.message || e))
    }
  }

  async function loadMyRequirements(tok = token) {
    if (!tok) return
    const res = await fetch(`${API}/requirements`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (!res.ok) return
    const data = await res.json()
    setRequirements(data)
  }

  async function createRequirement(e) {
    e.preventDefault()
    const form = new FormData()
    form.append('type', newReq.type)
    if (newReq.type === 'software') form.append('subtype', newReq.subtype)
    form.append('details', JSON.stringify(newReq.details))
    const res = await fetch(`${API}/requirements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) {
      const t = await res.text()
      setMessage(`Error: ${t}`)
      return
    }
    setMessage('Requirement created')
    loadMyRequirements()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-900">SaaSOTY v1</h1>
        {!token ? (
          <div className="mt-6 grid gap-3">
            <p className="text-slate-600">Choose a role to continue:</p>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <button key={r.key} className="px-4 py-2 rounded bg-slate-900 text-white" onClick={() => impersonate(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            {message && <p className="text-red-600 text-sm">{message}</p>}
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-700">Signed in as</p>
                <p className="font-medium">{user?.name || user?.email} · {user?.role}</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-sm text-blue-600 underline" onClick={() => loadMyRequirements()}>Refresh</button>
                <button className="text-sm text-slate-600 underline" onClick={() => { setToken(null); setUser(null); setRequirements([]) }}>Sign out</button>
              </div>
            </div>

            {user?.role === 'client' && (
              <div className="mt-6 bg-white rounded-lg border p-4">
                <h2 className="font-semibold mb-3">Create Requirement</h2>
                <form onSubmit={createRequirement} className="grid gap-3">
                  <div className="flex gap-3">
                    <select className="border rounded px-3 py-2" value={newReq.type} onChange={e=>setNewReq(r=>({...r, type:e.target.value}))}>
                      <option value="hardware">Hardware</option>
                      <option value="software">Software</option>
                    </select>
                    {newReq.type === 'software' && (
                      <select className="border rounded px-3 py-2" value={newReq.subtype} onChange={e=>setNewReq(r=>({...r, subtype:e.target.value}))}>
                        <option value="new">New</option>
                        <option value="renewal">Renewal</option>
                        <option value="upgrade">Upgrade</option>
                      </select>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <input className="border rounded px-3 py-2" placeholder="Product/Software name" onChange={e=>setNewReq(r=>({...r, details:{...r.details, name:e.target.value}}))} />
                    <input className="border rounded px-3 py-2" placeholder="Quantity" type="number" onChange={e=>setNewReq(r=>({...r, details:{...r.details, quantity:Number(e.target.value||0)}}))} />
                    <input className="border rounded px-3 py-2" placeholder="Expected delivery date" onChange={e=>setNewReq(r=>({...r, details:{...r.details, expected_delivery_date:e.target.value}}))} />
                    <input className="border rounded px-3 py-2" placeholder="Expected order confirmation date" onChange={e=>setNewReq(r=>({...r, details:{...r.details, expected_order_confirmation_date:e.target.value}}))} />
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>
                </form>
              </div>
            )}

            <div className="mt-6 bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">My Items</h2>
                <span className="text-xs text-slate-500">role-aware listing</span>
              </div>
              <div className="mt-3 grid gap-3">
                {requirements.map((r) => (
                  <div key={r.id} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{r.type} {r.subtype ? `· ${r.subtype}` : ''}</p>
                        <p className="text-sm text-slate-600">Status: {r.status}</p>
                      </div>
                      {user?.role === 'client' && r.status === 'awaiting_client_decision' && (
                        <div className="flex gap-2">
                          <button className="px-3 py-1.5 bg-emerald-600 text-white rounded" onClick={async()=>{
                            await fetch(`${API}/requirements/${r.id}/client-action`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ action: 'good_to_go'})})
                            loadMyRequirements()
                          }}>Good to Go</button>
                          <button className="px-3 py-1.5 bg-amber-600 text-white rounded" onClick={async()=>{
                            await fetch(`${API}/requirements/${r.id}/client-action`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ action: 'request_call'})})
                            loadMyRequirements()
                          }}>Request AE Call</button>
                        </div>
                      )}
                      {user?.role === 'client' && r.status === 'client_good_to_go' && (
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded" onClick={async()=>{
                          const form = new FormData();
                          form.append('po_number', `PO-${Date.now()}`)
                          await fetch(`${API}/requirements/${r.id}/po`, { method:'POST', headers: { Authorization:`Bearer ${token}` }, body: form })
                          loadMyRequirements()
                        }}>Submit PO</button>
                      )}
                      {user?.role === 'ae' && r.status === 'pending_ae_estimate' && (
                        <button className="px-3 py-1.5 bg-slate-900 text-white rounded" onClick={async()=>{
                          await fetch(`${API}/estimates`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ requirement_id: r.id, amount: 999, currency: 'USD', breakdown:{ items:[{label:'Item', amount:999}]}, notes:'Auto-estimate' }) })
                          loadMyRequirements()
                        }}>Send Estimate</button>
                      )}
                      {user?.role === 'verifier' && r.status === 'pending_verification' && (
                        <span className="text-xs text-slate-500">Review in PO tab</span>
                      )}
                    </div>
                  </div>
                ))}
                {requirements.length === 0 && (
                  <p className="text-sm text-slate-600">No items yet.</p>
                )}
              </div>
            </div>

            {user?.role === 'verifier' && (
              <VerifierPanel token={token} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VerifierPanel({ token }) {
  const [items, setItems] = useState([])
  const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  async function load() {
    const res = await fetch(`${API}/pos?status=pending_verification`, { headers: { Authorization: `Bearer ${token}` }})
    const data = await res.json()
    setItems(data)
  }
  useEffect(()=>{ load() },[])

  async function decide(id, decision) {
    await fetch(`${API}/pos/${id}/review`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ decision }) })
    load()
  }

  return (
    <div className="mt-6 bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Pending POs</h2>
        <button className="text-sm text-blue-600" onClick={load}>Refresh</button>
      </div>
      <div className="mt-3 grid gap-3">
        {items.map((p)=> (
          <div key={p.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">PO {p.po_number}</p>
              <p className="text-sm text-slate-600">Req: {p.requirement_id}</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-emerald-600 text-white rounded" onClick={()=>decide(p.id, 'verified')}>Verify</button>
              <button className="px-3 py-1.5 bg-rose-600 text-white rounded" onClick={()=>decide(p.id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-600">No POs to review.</p>
        )}
      </div>
    </div>
  )
}

export default App
