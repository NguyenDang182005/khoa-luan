import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.resolve(__dirname, '..', 'n8n-workflows');

// 1. Patch 01-router-agent.json
{
  const filePath = path.join(baseDir, '01-router-agent.json');
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const node of wf.nodes) {
    if (node.id === 'gemini-router') {
      node.parameters.modelName = 'models/gemini-2.5-flash';
      node.parameters.options = { temperature: 0.0, maxOutputTokens: 1024 };
    }
  }

  let routerRespond = wf.nodes.find(n => n.id === 'router-respond');
  if (!routerRespond) {
    routerRespond = {
      parameters: { respondWith: 'firstIncomingItem', options: {} },
      id: 'router-respond',
      name: 'Respond Chat Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1600, 300]
    };
    wf.nodes.push(routerRespond);
  } else {
    routerRespond.parameters.respondWith = 'firstIncomingItem';
  }

  wf.connections['Execute HR Q&A Agent'] = { main: [[{ node: 'Respond Chat Webhook', type: 'main', index: 0 }]] };
  wf.connections['Execute Training Agent'] = { main: [[{ node: 'Respond Chat Webhook', type: 'main', index: 0 }]] };
  wf.connections['Execute CSKH Agent'] = {
    main: [
      [{ node: 'Respond Chat Webhook', type: 'main', index: 0 }],
      [{ node: 'Respond Chat Webhook', type: 'main', index: 0 }]
    ]
  };

  fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
  console.log('✅ WF01 patched');
}

// 2. Patch 02-hr-qa-agent.json
{
  const filePath = path.join(baseDir, '02-hr-qa-agent.json');
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const node of wf.nodes) {
    if (node.id === 'gemini-hr') {
      node.parameters.modelName = 'models/gemini-2.5-flash';
      node.parameters.options = { temperature: 0.3, maxOutputTokens: 1024 };
    }
    if (node.id === 'hr-agent') {
      node.parameters.text = '={{ ($("Normalize Input").first().json.employeeId ? "[Thong tin nguoi dung - Ma nhan vien: " + $("Normalize Input").first().json.employeeId + "]\\n\\n" : "") + $("Normalize Input").first().json.maskedMessage }}';
    }
  }

  let fmtNode = wf.nodes.find(n => n.id === 'format-hr-output');
  if (!fmtNode) {
    fmtNode = {
      parameters: {
        jsCode: 'const answer = $("HR Agent").first().json.output;\nconst sessionId = $("Get/Create Session").first().json.id;\nconst employeeId = $("Normalize Input").first().json.employeeId;\nreturn [{ json: { answer, sessionId, employeeId, intent: "HR_QA" } }];'
      },
      id: 'format-hr-output',
      name: 'Format Output',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1560, 300]
    };
    wf.nodes.push(fmtNode);
  }

  const respNode = wf.nodes.find(n => n.id === 'respond');
  if (respNode) {
    respNode.position = [1780, 300];
    respNode.parameters = { respondWith: 'firstIncomingItem', options: {} };
  }

  wf.connections['Save Assistant Message'] = { main: [[{ node: 'Format Output', type: 'main', index: 0 }]] };
  wf.connections['Format Output'] = { main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]] };

  fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
  console.log('✅ WF02 patched');
}

// 3. Patch 03-training-agent.json
{
  const filePath = path.join(baseDir, '03-training-agent.json');
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const node of wf.nodes) {
    if (node.id === 'gemini-training') {
      node.parameters.modelName = 'models/gemini-2.5-flash';
      node.parameters.options = { temperature: 0.8, maxOutputTokens: 1024 };
    }
  }

  // Remove respond to webhook node in sub-workflow
  wf.nodes = wf.nodes.filter(n => n.id !== 'respond');

  let fmtNode = wf.nodes.find(n => n.id === 'format-training-output');
  if (!fmtNode) {
    fmtNode = {
      parameters: {
        jsCode: 'const pr = $("Parse Result").first().json;\nreturn [{ json: { answer: pr.roleplayResponse, roleplayResponse: pr.roleplayResponse, scoring: pr.scoring, sessionId: pr.sessionId, scenarioType: pr.scenarioType, intent: "TRAINING" } }];'
      },
      id: 'format-training-output',
      name: 'Format Training Output',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1740, 300]
    };
    wf.nodes.push(fmtNode);
  }

  wf.connections['Save Assistant Message'] = { main: [[{ node: 'Format Training Output', type: 'main', index: 0 }]] };
  delete wf.connections['Format Training Output'];

  fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
  console.log('✅ WF03 patched');
}

// 4. Patch 04-zalo-cskh.json
{
  const filePath = path.join(baseDir, '04-zalo-cskh.json');
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const node of wf.nodes) {
    if (node.id === 'gemini-cskh') {
      node.parameters.modelName = 'models/gemini-2.5-flash';
      node.parameters.options = { temperature: 0.5, maxOutputTokens: 1024 };
    }
    if (node.id === 'send-zalo') {
      node.continueOnFail = true;
    }
  }

  // Remove webhook-ack
  wf.nodes = wf.nodes.filter(n => n.id !== 'webhook-ack');

  let fmtNode = wf.nodes.find(n => n.id === 'format-cskh-output');
  if (!fmtNode) {
    fmtNode = {
      parameters: {
        jsCode: 'const p = $("Parse CSKH Output").first().json;\nreturn [{ json: { answer: p.answer, shouldEscalate: p.shouldEscalate, escalateReason: p.escalateReason, sessionId: p.sessionId, userId: p.userId, intent: "CSKH" } }];'
      },
      id: 'format-cskh-output',
      name: 'Format CSKH Output',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1760, 160]
    };
    wf.nodes.push(fmtNode);
  }

  wf.connections['Save Assistant Message'] = { main: [[{ node: 'Format CSKH Output', type: 'main', index: 0 }]] };
  delete wf.connections['Format CSKH Output'];
  delete wf.connections['Send Zalo Reply'];

  fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
  console.log('✅ WF04 patched');
}

console.log('All workflows patched with gemini-3.5-flash and response nodes!');
