import React, {useState} from 'react';
/** Frontend panel component. Supply authenticated API; never authorize from the browser. */
export function CultivarModerationPanel({api}) {
 const [items,setItems]=useState([]);const [error,setError]=useState('');
 async function refresh(){try{setItems(await api.listFlagged());setError('');}catch(e){setError(String(e));}}
 async function act(id,decision){try{await api.reviewCultivar({id,decision});await refresh();}catch(e){setError(String(e));}}
 return <section aria-label="Cultivar moderation">
  <h2>High Country — Cultivar moderation</h2>
  <p>Protected genetic ancestry is never deleted. Hidden and retired cultivars cannot be used or distributed.</p>
  <button onClick={refresh}>Refresh review queue</button>
  {error&&<p role="alert">{error}</p>}
  <ul>{items.map(x=><li key={x.id}>
    <strong>{x.safeDisplayName||`Cultivar HC-${x.id.slice(0,8)}`}</strong>
    <span> {x.status} </span>
    <button onClick={()=>act(x.id,'approve')}>Approve</button>
    <button onClick={()=>act(x.id,'hide')}>Hide / require rename</button>
    <button onClick={()=>act(x.id,'retire')}>Retire from game</button>
  </li>)}</ul>
 </section>;
}
