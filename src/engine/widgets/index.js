// Типовые виджеты станций. Каждый: (el, data, api) => cleanup?
// api: { done(), mistake(), sound, ctx } — см. stations.js.
import choice from './choice.js';
import sort from './sort.js';
import faceMap from './face-map.js';
import threshold from './threshold.js';
import appPermissions from './app-permissions.js';
import badgeEnroll from './badge-enroll.js';
import voiceCommand from './voice-command.js';
import voiceDemo from './voice-demo.js';
import incomingCall from './incoming-call.js';
import nextWord from './next-word.js';
import factCheck from './fact-check.js';
import chatTrap from './chat-trap.js';
import promptBuilder from './prompt-builder.js';
import classChat from './class-chat.js';
import ticTacToe from './tic-tac-toe.js';
import redFlags from './red-flags.js';
import vennSort from './venn-sort.js';
import suspiciousChat from './suspicious-chat.js';
import faceGate from './face-gate.js';
import adviceLight from './advice-light.js';
import presentEvidence from './present-evidence.js';
import rulesBuilder from './rules-builder.js';

export const WIDGETS = {
  choice, sort, 'face-map': faceMap, threshold, 'app-permissions': appPermissions, 'badge-enroll': badgeEnroll,
  'voice-command': voiceCommand, 'voice-demo': voiceDemo, 'incoming-call': incomingCall,
  'next-word': nextWord, 'fact-check': factCheck, 'chat-trap': chatTrap,
  'prompt-builder': promptBuilder, 'class-chat': classChat, 'tic-tac-toe': ticTacToe, 'red-flags': redFlags,
  'venn-sort': vennSort, 'suspicious-chat': suspiciousChat, 'face-gate': faceGate, 'advice-light': adviceLight,
  'present-evidence': presentEvidence, 'rules-builder': rulesBuilder,
};
