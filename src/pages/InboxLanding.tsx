import { ArrowRight, MessageCircle, MessagesSquare, Send, Sparkles, Layers, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import "@/styles/inbox-landing.css";

const benefits = [
  { icon: MessagesSquare, title: "A clearer view of conversations", text: "Bring customer messages into a shared view instead of jumping between channels." },
  { icon: Send, title: "Keep the conversation moving", text: "Read and respond from the dashboard Inbox, with conversations organized in one place." },
  { icon: Layers, title: "Room to grow", text: "Broadcasts, sequences and automations are available in the dashboard for eligible plans." },
];

export default function InboxLanding() {
  return <Layout variant="glass">
    <div className="inbox-landing">
      <section className="inbox-hero inbox-wrap">
        <div className="inbox-hero-copy">
          <div className="inbox-eyebrow"><span /> CITYWIDE DIGITAL / GUIDE</div>
          <h1>Understanding<br /><em>Inbox Pro.</em></h1>
          <p>Learn how Inbox brings customer conversations into your dashboard and explore plans for a standalone app.</p>
          <div className="inbox-actions"><Link className="inbox-button" to="/dashboard/inbox">Open dashboard Inbox <ArrowRight size={17} /></Link></div>
          <div className="inbox-note"><CheckCircle2 size={15} /> Available in your CityWide dashboard</div>
        </div>
        <div className="inbox-preview" aria-label="Illustrative Inbox conversation preview">
          <div className="inbox-preview-top"><div><span className="inbox-preview-mark"><MessageCircle size={17} /></span><strong>Inbox</strong></div><span>ILLUSTRATIVE PREVIEW</span></div>
          <div className="inbox-preview-body"><div className="inbox-list"><div className="inbox-list-heading">Conversations <span>●</span></div><div className="inbox-person active"><b>AM</b><div><strong>Alex Morgan</strong><small>Thanks for getting back to me!</small></div></div><div className="inbox-person"><b>JT</b><div><strong>Jamie Taylor</strong><small>Hi, I have a question...</small></div></div><div className="inbox-person"><b>SK</b><div><strong>Sam Kim</strong><small>That sounds great.</small></div></div></div><div className="inbox-thread"><div className="inbox-thread-header"><b>AM</b><div><strong>Alex Morgan</strong><small>Customer conversation</small></div></div><div className="inbox-thread-content"><span className="inbox-day">TODAY</span><div className="bubble">Hi! Could you tell me more about your services?</div><div className="bubble reply">Of course! We'd be happy to help.</div><div className="bubble">Thanks for getting back to me!</div></div><div className="inbox-compose">Write a reply... <Send size={16} /></div></div></div>
          <div className="inbox-preview-caption"><span /> One place for the conversations that matter</div>
        </div>
      </section>
      <section className="inbox-section inbox-wrap"><div className="inbox-section-intro"><div className="inbox-eyebrow">HOW INBOX WORKS</div><h2>Conversations in<br /><em>one view.</em></h2><p>Inbox provides a central place to view customer conversations, respond and access additional messaging tools.</p></div><div className="inbox-benefits">{benefits.map(({ icon: Icon, title, text }, i) => <article key={title}><div className="inbox-benefit-top"><Icon size={21} /><span>0{i + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="inbox-section inbox-wrap inbox-future"><div><div className="inbox-eyebrow">BUILT FOR THE WAY YOU WORK</div><h2>One Inbox.<br /><em>More possibilities.</em></h2></div><div><Sparkles size={27} /><h3>In the dashboard today.<br />Standalone in the future.</h3><p>Inbox is already part of your CityWide dashboard. A standalone app is planned for businesses that want to use Inbox on its own or alongside the rest of the CityWide suite.</p></div></section>
      <section className="inbox-wrap inbox-final"><div><div className="inbox-eyebrow">CONTINUE EXPLORING</div><h2>Find Inbox in<br /><em>your dashboard.</em></h2><p>Visit the dashboard to view the Inbox available to your account.</p></div><div className="inbox-actions"><Link className="inbox-button" to="/dashboard/inbox">Open dashboard Inbox <ArrowRight size={17} /></Link></div></section>
    </div>
  </Layout>;
}
