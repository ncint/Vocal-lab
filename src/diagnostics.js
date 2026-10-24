// diagnostics.js — registo e apresentação de mensagens de diagnóstico.

export class Diagnostics {
  constructor(el) {
    this.el = el;
  }

  log(level, message) {
    const line = document.createElement('div');
    line.className = level;
    const t = new Date().toLocaleTimeString();
    line.textContent = `[${t}] ${message}`;
    this.el.appendChild(line);
    this.el.scrollTop = this.el.scrollHeight;
    while (this.el.children.length > 200) this.el.firstChild.remove();
  }

  ok(msg) { this.log('ok', msg); }
  warn(msg) { this.log('warn', msg); }
  err(msg) { this.log('err', msg); }
  info(msg) { this.log('info', msg); }
}
