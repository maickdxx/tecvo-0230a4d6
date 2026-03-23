import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── GET /webchat-api?action=widget&org=<org_id> ──
    // Serves the widget JavaScript
    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      const orgId = url.searchParams.get("org");

      if (action === "widget" && orgId) {
        // Fetch config
        const { data: config } = await supabase
          .from("webchat_configs")
          .select("*")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .single();

        if (!config) {
          return new Response("// Webchat not configured", {
            headers: { ...corsHeaders, "Content-Type": "application/javascript" },
          });
        }

        const baseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        const widgetJS = generateWidgetJS(config, orgId, baseUrl, anonKey);
        return new Response(widgetJS, {
          headers: { ...corsHeaders, "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" },
        });
      }

      // ── GET /webchat-api?action=messages&session=<id>&org=<org_id> ──
      // Fetch messages for a session (polling)
      if (action === "messages" && orgId) {
        const sessionId = url.searchParams.get("session");
        if (!sessionId) {
          return new Response(JSON.stringify({ error: "session required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webchatJid = `webchat-${sessionId}`;

        // Find contact
        const { data: contact } = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("organization_id", orgId)
          .eq("whatsapp_id", webchatJid)
          .single();

        if (!contact) {
          return new Response(JSON.stringify({ messages: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch messages
        const { data: messages } = await supabase
          .from("whatsapp_messages")
          .select("id, content, is_from_me, timestamp, media_url, media_type")
          .eq("contact_id", contact.id)
          .eq("organization_id", orgId)
          .order("timestamp", { ascending: true })
          .limit(100);

        return new Response(JSON.stringify({ messages: messages || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: Send a message from the visitor ──
    if (req.method === "POST") {
      const body = await req.json();
      const { org_id, session_id, visitor_name, content, page_url, user_agent } = body;

      if (!org_id || !session_id || !content) {
        return new Response(JSON.stringify({ error: "org_id, session_id, content required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const webchatJid = `webchat-${session_id}`;

      // Find or create a webchat channel for this org
      let { data: channel, error: channelError } = await supabase
        .from("whatsapp_channels")
        .select("id")
        .eq("organization_id", org_id)
        .eq("channel_type", "WEBCHAT")
        .maybeSingle();

      if (!channel) {
        const { data: newChannel, error: newChannelError } = await supabase
          .from("whatsapp_channels")
          .insert({
            organization_id: org_id,
            name: "Chat do Site",
            channel_type: "WEBCHAT",
            is_connected: true,
            instance_name: `webchat-${org_id.replace(/-/g, "").substring(0, 12)}`,
          })
          .select("id")
          .single();
        if (newChannelError) {
          console.error("[WEBCHAT-API] Channel create error:", newChannelError);
        }
        channel = newChannel;
      }

      if (!channel) {
        return new Response(JSON.stringify({ error: "Failed to create channel" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find or create contact
      let { data: contact, error: contactError } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("organization_id", org_id)
        .eq("whatsapp_id", webchatJid)
        .maybeSingle();

      const visitorMeta = {
        page_url: page_url || null,
        user_agent: user_agent || null,
        last_seen: new Date().toISOString(),
      };

      if (!contact) {
        const { data: newContact, error: newContactError } = await supabase
          .from("whatsapp_contacts")
          .insert({
            organization_id: org_id,
            whatsapp_id: webchatJid,
            name: visitor_name || `Visitante ${session_id.substring(0, 6)}`,
            channel_id: channel.id,
            source: "webchat",
            is_unread: true,
            unread_count: 1,
            last_message_at: new Date().toISOString(),
            last_message_content: content.substring(0, 200),
            last_message_is_from_me: false,
            conversation_status: "novo",
            visitor_metadata: visitorMeta,
          })
          .select("id")
          .single();
        if (newContactError) {
          console.error("[WEBCHAT-API] Contact create error:", newContactError);
        }
        contact = newContact;
      } else {
        // Fetch current status to decide if we should reopen
        const { data: currentData } = await supabase
          .from("whatsapp_contacts")
          .select("conversation_status")
          .eq("id", contact.id)
          .single();
        
        const currentStatus = currentData?.conversation_status || "novo";
        // Only reopen if finalized; if "atendendo" keep it stable
        const newStatus = currentStatus === "resolvido" ? "novo" : currentStatus;

        // Update contact
        await supabase
          .from("whatsapp_contacts")
          .update({
            is_unread: true,
            unread_count: 1,
            last_message_at: new Date().toISOString(),
            last_message_content: content.substring(0, 200),
            last_message_is_from_me: false,
            conversation_status: newStatus,
            visitor_metadata: visitorMeta,
            ...(visitor_name ? { name: visitor_name } : {}),
          })
          .eq("id", contact.id);
      }

      if (!contact) {
        return new Response(JSON.stringify({ error: "Failed to create contact" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save message
      const messageId = `webchat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      await supabase.from("whatsapp_messages").insert({
        organization_id: org_id,
        contact_id: contact.id,
        message_id: messageId,
        content,
        is_from_me: false,
        timestamp: new Date().toISOString(),
        channel_id: channel.id,
        status: "received",
      });

      return new Response(JSON.stringify({ ok: true, contact_id: contact.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WEBCHAT-API] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateWidgetJS(config: any, orgId: string, baseUrl: string, anonKey: string): string {
  return `
(function() {
  if (window.__tecvoWebchatLoaded) return;
  window.__tecvoWebchatLoaded = true;

  var CONFIG = {
    orgId: "${orgId}",
    apiUrl: "${baseUrl}/functions/v1/webchat-api",
    anonKey: "${anonKey}",
    position: "${config.position || 'right'}",
    color: "${config.color || '#2563eb'}",
    buttonText: ${JSON.stringify(config.button_text || '')},
    welcomeMessage: ${JSON.stringify(config.welcome_message || '')},
    autoShowWelcome: ${config.auto_show_welcome ? 'true' : 'false'},
    displayName: ${JSON.stringify(config.display_name || 'Atendimento')},
    avatarUrl: ${JSON.stringify(config.avatar_url || '')},
    bottomDistance: ${config.bottom_distance || 20}
  };

  var sessionId = localStorage.getItem('tecvo_webchat_session');
  if (!sessionId) {
    sessionId = 'wc_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('tecvo_webchat_session', sessionId);
  }

  var visitorName = localStorage.getItem('tecvo_webchat_name') || '';
  var isOpen = false;
  var messages = [];
  var pollInterval = null;

  // Create styles
  var style = document.createElement('style');
  style.textContent = \`
    #tecvo-webchat-btn {
      position: fixed;
      bottom: \${CONFIG.bottomDistance}px;
      \${CONFIG.position === 'left' ? 'left: 20px;' : 'right: 20px;'}
      z-index: 99999;
      background: \${CONFIG.color};
      color: white;
      border: none;
      border-radius: 50px;
      padding: 14px 20px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
    }
    #tecvo-webchat-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 25px rgba(0,0,0,0.2);
    }
    #tecvo-webchat-btn svg {
      width: 20px;
      height: 20px;
      fill: white;
    }
    #tecvo-webchat-panel {
      position: fixed;
      bottom: \${CONFIG.bottomDistance + 70}px;
      \${CONFIG.position === 'left' ? 'left: 20px;' : 'right: 20px;'}
      z-index: 99999;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #tecvo-webchat-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .tcv-header {
      background: \${CONFIG.color};
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .tcv-header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .tcv-header-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .tcv-header-info h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }
    .tcv-header-info p {
      margin: 2px 0 0;
      font-size: 12px;
      opacity: 0.85;
    }
    .tcv-header-close {
      margin-left: auto;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    .tcv-header-close:hover { opacity: 1; }
    .tcv-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #f8f9fa;
    }
    .tcv-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .tcv-msg-visitor {
      align-self: flex-end;
      background: \${CONFIG.color};
      color: white;
      border-bottom-right-radius: 4px;
    }
    .tcv-msg-agent {
      align-self: flex-start;
      background: white;
      color: #1a1a1a;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px;
    }
    .tcv-msg-time {
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
    }
    .tcv-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 8px;
      align-items: center;
      background: white;
    }
    .tcv-input {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
    }
    .tcv-input:focus {
      border-color: \${CONFIG.color};
    }
    .tcv-send-btn {
      background: \${CONFIG.color};
      color: white;
      border: none;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }
    .tcv-send-btn:hover { opacity: 0.9; }
    .tcv-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tcv-footer {
      text-align: center;
      padding: 6px;
      font-size: 10px;
      color: #9ca3af;
      background: white;
      border-top: 1px solid #f3f4f6;
    }
    .tcv-footer a {
      color: #9ca3af;
      text-decoration: none;
    }
    .tcv-footer a:hover { text-decoration: underline; }
    .tcv-name-form {
      padding: 20px;
      text-align: center;
    }
    .tcv-name-form p {
      margin: 0 0 12px;
      font-size: 13px;
      color: #6b7280;
    }
    .tcv-name-input {
      width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 10px;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    .tcv-name-input:focus { border-color: \${CONFIG.color}; }
    .tcv-name-btn {
      background: \${CONFIG.color};
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      font-family: inherit;
    }
    .tcv-welcome-bubble {
      position: fixed;
      bottom: \${CONFIG.bottomDistance + 65}px;
      \${CONFIG.position === 'left' ? 'left: 20px;' : 'right: 20px;'}
      z-index: 99998;
      background: white;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      font-size: 13px;
      color: #374151;
      max-width: 260px;
      cursor: pointer;
      animation: tcvSlideIn 0.4s ease;
    }
    .tcv-welcome-close {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #e5e7eb;
      border: none;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
    }
    @keyframes tcvSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  \`;
  document.head.appendChild(style);

  // Chat icon SVG
  var chatIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>';
  var closeIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var sendIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  // Create button
  var btn = document.createElement('button');
  btn.id = 'tecvo-webchat-btn';
  btn.innerHTML = chatIconSvg + (CONFIG.buttonText ? '<span>' + CONFIG.buttonText + '</span>' : '');
  document.body.appendChild(btn);

  // Create panel
  var panel = document.createElement('div');
  panel.id = 'tecvo-webchat-panel';

  var avatarHtml = CONFIG.avatarUrl
    ? '<img src="' + CONFIG.avatarUrl + '" alt="avatar">'
    : '<svg viewBox="0 0 24 24" fill="white" style="width:22px;height:22px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  panel.innerHTML = '<div class="tcv-header">'
    + '<div class="tcv-header-avatar">' + avatarHtml + '</div>'
    + '<div class="tcv-header-info"><h3>' + CONFIG.displayName + '</h3><p>Responderemos em breve</p></div>'
    + '<button class="tcv-header-close" id="tcv-close">' + closeIconSvg + '</button>'
    + '</div>'
    + '<div class="tcv-messages" id="tcv-messages"></div>'
    + '<div class="tcv-input-area" id="tcv-input-area" style="display:none">'
    + '<input class="tcv-input" id="tcv-input" placeholder="Digite sua mensagem..." />'
    + '<button class="tcv-send-btn" id="tcv-send">' + sendIconSvg + '</button>'
    + '</div>'
    + '<div class="tcv-footer"><a href="https://tecvo.lovable.app" target="_blank">Powered by Tecvo</a></div>';
  document.body.appendChild(panel);

  var messagesDiv = document.getElementById('tcv-messages');
  var inputArea = document.getElementById('tcv-input-area');
  var inputEl = document.getElementById('tcv-input');
  var sendBtn = document.getElementById('tcv-send');

  function showNameForm() {
    messagesDiv.innerHTML = '<div class="tcv-name-form">'
      + (CONFIG.welcomeMessage ? '<p>' + CONFIG.welcomeMessage + '</p>' : '')
      + '<p>Como podemos te chamar?</p>'
      + '<input class="tcv-name-input" id="tcv-name-input" placeholder="Seu nome" />'
      + '<button class="tcv-name-btn" id="tcv-name-btn">Iniciar conversa</button>'
      + '</div>';
    var nameInput = document.getElementById('tcv-name-input');
    var nameBtn = document.getElementById('tcv-name-btn');
    nameBtn.onclick = function() {
      var name = nameInput.value.trim();
      if (name) {
        visitorName = name;
        localStorage.setItem('tecvo_webchat_name', name);
        startChat();
      }
    };
    nameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') nameBtn.click();
    });
  }

  function startChat() {
    inputArea.style.display = 'flex';
    messagesDiv.innerHTML = '';
    if (CONFIG.welcomeMessage) {
      addMessageToUI(CONFIG.welcomeMessage, true, new Date());
    }
    fetchMessages();
    startPolling();
  }

  function addMessageToUI(text, isAgent, time) {
    var div = document.createElement('div');
    div.className = 'tcv-msg ' + (isAgent ? 'tcv-msg-agent' : 'tcv-msg-visitor');
    var timeStr = time ? new Date(time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
    div.innerHTML = text + '<div class="tcv-msg-time">' + timeStr + '</div>';
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function renderMessages(msgs) {
    messagesDiv.innerHTML = '';
    if (CONFIG.welcomeMessage && msgs.length === 0) {
      addMessageToUI(CONFIG.welcomeMessage, true, new Date());
    }
    msgs.forEach(function(m) {
      addMessageToUI(m.content || '', m.is_from_me, m.timestamp);
    });
  }

  function fetchMessages() {
    fetch(CONFIG.apiUrl + '?action=messages&org=' + CONFIG.orgId + '&session=' + sessionId, {
      headers: { 'apikey': CONFIG.anonKey }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.messages && data.messages.length > 0) {
        messages = data.messages;
        renderMessages(messages);
      }
    })
    .catch(function() {});
  }

  function sendMessage(text) {
    addMessageToUI(text, false, new Date());
    fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.anonKey },
      body: JSON.stringify({
        org_id: CONFIG.orgId,
        session_id: sessionId,
        visitor_name: visitorName,
        content: text,
        page_url: window.location.href,
        user_agent: navigator.userAgent
      })
    }).catch(function() {});
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchMessages, 5000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  // Events
  btn.onclick = function() {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('open');
      hideWelcomeBubble();
      if (!visitorName) {
        showNameForm();
      } else {
        startChat();
      }
    } else {
      panel.classList.remove('open');
      stopPolling();
    }
  };

  document.getElementById('tcv-close').onclick = function() {
    isOpen = false;
    panel.classList.remove('open');
    stopPolling();
  };

  sendBtn.onclick = function() {
    var text = inputEl.value.trim();
    if (text) {
      sendMessage(text);
      inputEl.value = '';
    }
  };

  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Auto-show welcome bubble
  if (CONFIG.autoShowWelcome && CONFIG.welcomeMessage) {
    setTimeout(function() {
      if (!isOpen) {
        var bubble = document.createElement('div');
        bubble.className = 'tcv-welcome-bubble';
        bubble.id = 'tcv-welcome-bubble';
        bubble.innerHTML = CONFIG.welcomeMessage + '<button class="tcv-welcome-close" id="tcv-welcome-close">&times;</button>';
        document.body.appendChild(bubble);
        bubble.onclick = function(e) {
          if (e.target.id !== 'tcv-welcome-close') {
            btn.click();
          }
        };
        document.getElementById('tcv-welcome-close').onclick = function(e) {
          e.stopPropagation();
          hideWelcomeBubble();
        };
      }
    }, 3000);
  }

  function hideWelcomeBubble() {
    var b = document.getElementById('tcv-welcome-bubble');
    if (b) b.remove();
  }
})();
`;
}
