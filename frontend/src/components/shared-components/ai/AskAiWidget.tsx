'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, HelpCircle, Mail, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '@/lib/zustand/user/user';
import { askAiGuide, sendSupportEmail } from '@/lib/api/ai-support';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    isFallback?: boolean;
}

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
    superadmin: [
        "How do I onboard a new company?",
        "How do I view all companies?",
        "Where can I change my profile settings?",
        "What does a Superadmin do?",
        "What is a Platform Role?"
    ],
    admin: [
        "How do I add a new team member?",
        "How do I create a new project template?",
        "How do I set company holidays?",
        "How do I set a user's role?",
        "What is a Platform Role?",
        "What is a Workflow Role?"
    ],
    controller: [
        "How do I create an instance?",
        "How do I pause or stop an instance?",
        "How do I view overdue tasks?",
        "How do I change an approver for a task?",
        "How do I manually Unlock a task?",
        "How do I change the assigned user for a task?",
        "How does scheduling an instance work?",
        "How does the Repeat feature work?"
    ],
    member: [
        "How do I submit a task?",
        "Why is my task Locked?",
        "What happens if my task is rejected?",
        "How do I review a task?",
        "What is a Platform Role?",
        "What is a Workflow Role?"
    ]
};

const LOCAL_CHAT_RESPONSES: Record<string, string> = {
    "hi": "Hello! I'm your FMS Guide. How can I assist you today?",
    "hello": "Hello! I'm your FMS Guide. How can I assist you today?",
    "hey": "Hey there! How can I help you with FMS today?",
    "hii": "Hello! I'm your FMS Guide. How can I help you?",
    "heyy": "Hey! What can I help you with today?",
    "how are you": "I'm doing great, thank you for asking! Ready to help you navigate FMS.",
    "how are you doing": "All good here! How can I make your work easier today?",
    "how's it going": "It's going well! How can I help you today?",
    "how's everything": "Everything's great on my end! What do you need help with?",
    "who are you": "I'm the FMS AI Guide — your built-in assistant for navigating the platform, understanding workflows, and getting task-related help.",
    "what are you": "I'm the FMS AI Guide — I can answer questions about tasks, templates, roles, and anything else in the system.",
    "what can you do": "I can help you navigate the platform, explain workflows, answer questions about tasks, instances, templates, and provide guidance based on your role.",
    "what do you do": "I help you get things done in FMS! Ask me anything about tasks, projects, users, roles, or how the system works.",
    "help": "Of course! Ask me any question about FMS — tasks, projects, approvals, roles, or anything else.",
    "i need help": "I'm here for you! What do you need help with?",
    "thanks": "You're very welcome! Let me know if you need anything else.",
    "thank you": "You're very welcome! Let me know if you need anything else.",
    "thank you so much": "Happy to help! Let me know if there's anything else.",
    "ok": "Got it! Let me know if you have any questions.",
    "okay": "Got it! Let me know if you have any questions.",
    "cool": "Awesome! Is there anything else I can help you with?",
    "great": "Glad to hear it! Let me know if you need anything.",
    "nice": "Great! Is there anything else I can help with?",
    "got it": "Perfect! Feel free to ask if you have any more questions.",
    "understood": "Great! Feel free to ask if anything's unclear.",
    "bye": "Goodbye! Have a productive day! 👋",
    "goodbye": "Goodbye! Have a productive day! 👋",
    "see you": "See you! Have a great day! 👋",
    "lol": "😄 Is there anything I can help you with?",
    "haha": "😄 Let me know if there's anything you need!",
    "wow": "Right?! 😄 Let me know if you have any questions."
};

// Each entry: keywords match the CURRENT question, suggestion is a DIFFERENT but related NEXT STEP
const FOLLOW_UP_LOGIC = [
    // Member follow-ups
    { keywords: ['submit', 'complete', 'checklist'], suggestion: "What happens if my task is rejected?" },
    { keywords: ['reject', 'rejected'], suggestion: "Where can I see my reviews?" },
    { keywords: ['review', 'my reviews', 'approve'], suggestion: "What happens if my task is rejected?" },
    { keywords: ['checklist', 'tick', 'check off'], suggestion: "Why is the submit button not working?" },
    { keywords: ['locked', 'lock'], suggestion: "What happens if my task is rejected?" },
    { keywords: ['pending approval', 'approved'], suggestion: "How do I submit a task?" },

    // Controller follow-ups
    { keywords: ['unlock', 'manual unlock'], suggestion: "How do I bypass a task?" },
    { keywords: ['bypass', 'force complete'], suggestion: "How do I extend a task deadline?" },
    { keywords: ['pause', 'paused'], suggestion: "How do I resume a paused instance?" },
    { keywords: ['resume', 'resumed'], suggestion: "How do I view overdue tasks?" },
    { keywords: ['reassign', 'assigned user'], suggestion: "How do I change an approver for a task?" },
    { keywords: ['instance', 'create instance', 'launch'], suggestion: "How does scheduling an instance work?" },
    { keywords: ['scheduling', 'schedule'], suggestion: "How does the Repeat feature work?" },
    { keywords: ['repeat', 'recurring'], suggestion: "How does scheduling an instance work?" },
    { keywords: ['overdue', 'sla', 'deadline', 'performance'], suggestion: "How do I extend a task deadline?" },
    { keywords: ['recurring', 'repeat'], suggestion: "How do I view overdue tasks?" },
    { keywords: ['quick task', 'manual task'], suggestion: "How do I create an instance?" },

    // Admin follow-ups
    { keywords: ['template', 'workflow', 'blueprint'], suggestion: "How do I add tasks to a template?" },
    { keywords: ['checklist item', 'task steps'], suggestion: "How do I set up approval for a task in a template?" },
    { keywords: ['user', 'team member', 'add user'], suggestion: "How do I set a user role?" },
    { keywords: ['role', 'platform role', 'permission'], suggestion: "What is a Workflow Role?" },
    { keywords: ['workflow role', 'role definition'], suggestion: "What is a Platform Role?" },
    { keywords: ['platform role', 'workflow role'], suggestion: "What are the different roles in FMS?" },
    { keywords: ['scheduled', 'scheduling', 'schedule'], suggestion: "How does the Repeat feature work?" },
    { keywords: ['repeat', 'recurring', 'recurrence'], suggestion: "How does scheduling an instance work?" },
    { keywords: ['holiday', 'holidays'], suggestion: "How do I create a new project template?" },

    // General follow-ups
    { keywords: ['report', 'export', 'download'], suggestion: "How do I view performance metrics?" },
    { keywords: ['notification', 'alert', 'bell'], suggestion: "How do I reset my password?" },
    { keywords: ['password', 'reset password'], suggestion: "Where can I change my profile settings?" },
    { keywords: ['profile', 'name', 'email'], suggestion: "How do I reset my password?" },
];

export function AskAiWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [faqDocs, setFaqDocs] = useState('');
    const [docFiles, setDocFiles] = useState<{ name: string, content: string }[]>([]);
    const [emailSent, setEmailSent] = useState(false);
    const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

    const { user } = useAuthStore();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Persist messages per user
    const storageKey = `fms-ai-chat-${user?.id || 'guest'}`;

    // Reset widget state cleanly if the user changes to avoid carrying over old chats
    useEffect(() => {
        setMessages([]);
        setIsOpen(false);
        setDynamicSuggestions([]);
    }, [user?.id]);

    useEffect(() => {
        if (isOpen) {
            const stored = sessionStorage.getItem(storageKey);
            const storedTime = sessionStorage.getItem(`${storageKey}-time`);

            // Check if session is explicitly expired (e.g. > 1 hour old)
            const isExpired = storedTime && (Date.now() - parseInt(storedTime) > 60 * 60 * 1000);

            if (stored && !isExpired) {
                try {
                    setMessages(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse chat history');
                }
            } else {
                // Clear old history if expired
                if (isExpired) {
                    sessionStorage.removeItem(storageKey);
                    sessionStorage.removeItem(`${storageKey}-time`);
                }
                setMessages([
                    {
                        id: 'init',
                        role: 'ai',
                        content: `Hi ${user?.name || 'there'}! I'm your FMS Guide. How can I assist you today?`
                    }
                ]);
            }
        }
    }, [isOpen, storageKey, user]);

    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem(storageKey, JSON.stringify(messages));
            sessionStorage.setItem(`${storageKey}-time`, Date.now().toString());
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, storageKey]);

    // Load local FAQ and other docs on mount to save API costs and feed Groq
    useEffect(() => {
        const fetchDocs = async () => {
            try {
                const files = [
                    '/docs/faq-guide.md',
                    '/docs/instance-workflows.md',
                    '/docs/templates-and-projects.md',
                    '/docs/auth-and-roles.md',
                    '/docs/system-architecture.md'
                ];

                const responses = await Promise.all(
                    files.map(async (file) => {
                        try {
                            const res = await fetch(file);
                            const text = await res.text();
                            return { name: file, content: text };
                        } catch (e) {
                            return { name: file, content: '' };
                        }
                    })
                );

                // faqDocs is the first one for our zero-cost interceptor
                setFaqDocs(responses[0]?.content || '');
                setDocFiles(responses);
            } catch (err) {
                console.error("Failed to load docs", err);
            }
        };
        fetchDocs();
    }, []);



    const STOP_WORDS = new Set(['how', 'do', 'i', 'can', 'you', 'to', 'make', 'create', 'a', 'an', 'the', 'is', 'what', 'where', 'when', 'why', 'who', 'in', 'on', 'at', 'for', 'with', 'about', 'and', 'or', 'not', 'it', 'my', 'that', 'this', 'of', 'me', 'us', 'we', 'your']);

    /**
     * Parse the FAQ file into individual Q&A pairs.
     * Returns: [{ question: string, answer: string }]
     */
    const parseFaqPairs = (content: string): { question: string; answer: string }[] => {
        const pairs: { question: string; answer: string }[] = [];
        const lines = content.split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            if (line.startsWith('**Q:')) {
                const question = line.replace(/\*\*Q:\*\*\s*/i, '').replace(/\*\*/g, '').trim();
                let answerLines: string[] = [];
                let j = i + 1;
                while (j < lines.length && !lines[j].trim().startsWith('**Q:') && !lines[j].trim().startsWith('##') && !lines[j].trim().startsWith('---')) {
                    const l = lines[j].trim();
                    if (l !== '' || answerLines.length > 0) {
                        answerLines.push(lines[j]);
                    }
                    j++;
                }
                const answer = answerLines.join('\n').trim().replace(/^\*\*A:\*\*\s*/i, '');
                if (question && answer) {
                    pairs.push({ question, answer });
                }
                i = j;
            } else {
                i++;
            }
        }
        return pairs;
    };

    /**
     * Robust local search:
     * 1. First searches FAQ Q&A pairs — returns only the single best-matching answer.
     * 2. Falls back to section-based search in technical docs if no FAQ match.
     */
    const searchLocalDocs = (query: string): string | null => {
        if (!docFiles.length) return null;

        const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        const queryKeywords = normalizedQuery.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));
        if (queryKeywords.length === 0) return null;

        // 1. Search individual FAQ Q&A pairs (always returns exactly one answer)
        const faqFile = docFiles.find(f => f.name.includes('faq-guide.md'));
        if (faqFile) {
            const pairs = parseFaqPairs(faqFile.content);
            let bestPair = { answer: '', score: 0 };

            pairs.forEach(({ question, answer }) => {
                const lowerQ = question.toLowerCase().replace(/[^a-z0-9 ]/g, '');
                let score = 0;

                queryKeywords.forEach(kw => {
                    if (lowerQ.includes(kw)) {
                        score += 20; // Strong bonus for keyword in question line
                        const regex = new RegExp(`\\b${kw}\\b`, 'g');
                        const count = (lowerQ.match(regex) || []).length;
                        score += count * 5;
                    }
                    // Small bonus for keyword appearing in answer too
                    if (answer.toLowerCase().includes(kw)) {
                        score += 2;
                    }
                });

                if (score > bestPair.score) {
                    bestPair = { answer, score };
                }
            });

            // Threshold: at least one keyword must have matched in a question
            if (bestPair.score >= 20) {
                return bestPair.answer;
            }
        }

        // 2. Fallback: section-based search in technical docs (not FAQ)
        let bestMatch = { content: '', score: 0 };
        const technicalDocs = docFiles.filter(f => !f.name.includes('faq-guide.md'));

        technicalDocs.forEach(file => {
            const sections = file.content.split(/\n(?=#{2,3}\s)/);
            sections.forEach(section => {
                const lowerSection = section.toLowerCase();
                let score = 0;

                // Skip technical tables and code blocks
                if (section.includes('| --- |') || section.includes('```')) {
                    score -= 30;
                }

                queryKeywords.forEach(kw => {
                    if (lowerSection.includes(kw)) {
                        score += 10;
                        const regex = new RegExp(`\\b${kw}\\b`, 'g');
                        score += (lowerSection.match(regex) || []).length * 2;
                        if (section.split('\n')[0].toLowerCase().includes(kw)) score += 15;
                    }
                });

                if (score > bestMatch.score) {
                    bestMatch = { content: section, score };
                }
            });
        });

        if (bestMatch.score >= 20) {
            const lines = bestMatch.content.split('\n');
            return lines.slice(1).join('\n').trim() || bestMatch.content;
        }

        return null;
    };

    const handleSendMessage = async (customInput?: string) => {
        const messageText = (customInput || input).trim();
        if (!messageText || !user) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        setEmailSent(false);
        setDynamicSuggestions([]); // Clear suggestions on new message

        // 0. Intercept local chat/greetings
        const cleanInput = messageText.toLowerCase().replace(/[?!.,]/g, '').trim();
        if (LOCAL_CHAT_RESPONSES[cleanInput]) {
            setTimeout(() => {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: LOCAL_CHAT_RESPONSES[cleanInput] }]);
                setIsTyping(false);
            }, 500);
            return;
        }

        // 1. Check local search index (Highest Cost Saving)
        const localResponse = searchLocalDocs(messageText);
        if (localResponse) {
            setTimeout(() => {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: localResponse }]);
                setIsTyping(false);

                // Role-aware follow-up suggestions (never repeat the current question)
                const userRole = user.platform_role?.toLowerCase() || 'member';
                const roleQuestions = SUGGESTED_QUESTIONS[userRole] || SUGGESTED_QUESTIONS.member;
                const followUp = FOLLOW_UP_LOGIC.find(f =>
                    // Keywords match what was just asked
                    f.keywords.some(k => messageText.toLowerCase().includes(k)) &&
                    // The suggestion is NOT the same as the question just asked
                    f.suggestion.toLowerCase() !== messageText.toLowerCase().trim() &&
                    // The suggestion exists in this role's known questions OR in any FAQ
                    (roleQuestions.includes(f.suggestion) || Object.values(SUGGESTED_QUESTIONS).flat().includes(f.suggestion))
                );
                if (followUp) {
                    setDynamicSuggestions([followUp.suggestion]);
                }
            }, 600);
            return;
        }

        // 2. Call backend (Groq Llama-3.3) only if local search fails
        const contextToSend = docFiles.map(f => f.content).join('\n\n---\n\n').slice(0, 8000); // Token limit safety

        // 2. Call backend (Groq Llama-3.3) with history
        const recentHistory = messages
            .filter(m => m.id !== 'init' && !m.isFallback)
            .slice(-6)
            .map(m => ({ role: m.role, content: m.content }));

        const response = await askAiGuide(messageText, user.platform_role || 'member', contextToSend, recentHistory);

        setIsTyping(false);

        if (response.fallbackRequired) {
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'ai',
                    content: "I don't have the answer to that right now. Would you like me to send a request to support?",
                    isFallback: true
                }
            ]);
        } else if (response.reply) {
            setMessages(prev => [
                ...prev,
                { id: Date.now().toString(), role: 'ai', content: response.reply! }
            ]);

            // Generate dynamic follow-up suggestions
            const newSuggestions = FOLLOW_UP_LOGIC
                .filter(f => f.keywords.some(k => response.reply!.toLowerCase().includes(k)))
                .map(f => f.suggestion)
                .slice(0, 2);
            setDynamicSuggestions(newSuggestions);
        } else {
            setMessages(prev => [
                ...prev,
                { id: Date.now().toString(), role: 'ai', content: "Something went wrong while connecting to the AI. Please try again later." }
            ]);
        }
    };

    const handleSendSupportEmail = async (messageContext: string) => {
        setEmailSent(false);
        const res = await sendSupportEmail(messageContext);
        if (res.success) {
            setEmailSent(true);
        } else {
            alert('Failed to send email. Please try again.');
        }
    };

    if (!user) return null; // Wait for auth

    return (
        <div className="fixed bottom-[var(--ai-widget-bottom,1.5rem)] right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="bg-white border rounded-lg shadow-xl w-80 sm:w-96 h-[500px] flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5">
                    {/* Header */}
                    <div className="text-primary-foreground p-4 flex justify-between items-center bg-indigo-600">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5" />
                            <span className="font-semibold">Ask FMS Support</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:opacity-80 transition-opacity text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
                        {messages?.map((msg) => (
                            <div key={msg.id} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>
                                <div className={`px-4 py-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border text-slate-800 rounded-tl-none shadow-sm'}`}>
                                    <div className="prose prose-sm max-w-none prose-slate prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:p-2 prose-pre:rounded prose-code:text-indigo-600">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>

                                    {/* Fallback Email UI */}
                                    {msg.isFallback && msg.role === 'ai' && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            {emailSent ? (
                                                <p className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                                                    Support request sent successfully!
                                                </p>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="w-full gap-2 bg-slate-900 hover:bg-slate-800 text-white"
                                                    onClick={() => handleSendSupportEmail(messages[messages.length - 2]?.content || 'Unknown Context')}
                                                >
                                                    <Mail className="w-4 h-4" /> Send Support Request
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Initial Role-Based Suggestions */}
                        {messages.length === 1 && !isTyping && (
                            <div className="flex flex-col gap-2 mt-2 px-10">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Suggested Questions</p>
                                <div className="flex flex-wrap gap-2">
                                    {(SUGGESTED_QUESTIONS[user.platform_role?.toLowerCase()] || SUGGESTED_QUESTIONS.member).map((q, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSendMessage(q)}
                                            className="text-left text-xs bg-white border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dynamic Follow-up Suggestions */}
                        {dynamicSuggestions.length > 0 && !isTyping && (
                            <div className="flex flex-col gap-2 mt-1 px-10 slide-in-from-bottom-2 animate-in duration-300">
                                <div className="flex flex-wrap gap-2">
                                    {dynamicSuggestions.map((q, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSendMessage(q)}
                                            className="text-left text-[11px] bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-all"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isTyping && (
                            <div className="flex gap-2 max-w-[85%] self-start">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-200 text-slate-700">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="px-4 py-3 rounded-lg text-sm bg-white border text-slate-800 rounded-tl-none shadow-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    <span className="text-slate-500">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                            className="flex gap-2"
                        >
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question..."
                                className="flex-1 focus-visible:ring-primary"
                                disabled={isTyping}
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!input.trim() || isTyping}
                                className="bg-primary hover:bg-primary/80 text-primary-foreground shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group flex items-center bg-primary text-primary-foreground rounded-full shadow-lg h-14 overflow-hidden transition-shadow hover:shadow-xl"
                >
                    {/* Icon area */}
                    <span className="w-14 h-14 shrink-0 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6" />
                    </span>

                    {/* Label — slides in on hover */}
                    <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:pr-4 transition-all duration-300 text-sm font-medium">
                        Ask AI
                    </span>
                </button>
            )
            }
        </div >
    );
}
