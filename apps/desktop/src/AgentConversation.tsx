import {useState} from 'react';
import type {AgentEvent} from '../../../packages/agent/src/types.ts';
import {MarkdownView} from './MarkdownView.tsx';

export function AgentConversation({events,initialPrompt}:{events:AgentEvent[];initialPrompt?:string}) {
 const [link,setLink]=useState('');
 const messages=events.filter(event=>event.kind==='message'&&event.role!=='system');
 return <div className="agent-conversation" aria-label="Conversation avec l’agent">
  {initialPrompt&&!messages.some(event=>event.role==='user')&&<div className="agent-message user"><small>Vous</small><p>{initialPrompt}</p></div>}
  {messages.map((event,i)=><div className={`agent-message ${event.role==='user'?'user':'assistant'}`} key={i}>
   <small>{event.role==='user'?'Vous':'CPCéleste'}</small>
   {event.role==='user'?<p>{event.text}</p>:<MarkdownView source={event.text} onLink={setLink}/>}
  </div>)}
  {link&&<div className="agent-link"><label>Destination du lien<input aria-label="Lien de la réponse" value={link} readOnly/></label><button onClick={()=>setLink('')}>Fermer le lien</button></div>}
 </div>;
}
