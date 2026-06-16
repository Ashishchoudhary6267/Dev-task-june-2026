'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import {
    MessageSquare,
    Send,
    Settings as SettingsIcon,
    Bot,
    User,
    Cpu,
    Zap,
    Info,
    Trash2,
    BookOpen,
    ClipboardCopy,
    ClipboardCheck,
    FileText,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Server,
} from 'lucide-react';
import {
    Button,
    Input,
    Badge,
    Card,
    Textarea,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
    role: 'user' | 'assistant';
    content: string;
    thought?: string;
    issueReport?: IssueReport;
}

interface IssueReport {
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    rootCause: string;
    affectedAreas: string[];
    stepsToReproduce: string[];
    suggestedFix: string;
    claudePrompt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<IssueReport['severity'], string> = {
    critical: 'bg-red-500/10 text-red-600 border-red-300 dark:text-red-400',
    high: 'bg-orange-500/10 text-orange-600 border-orange-300 dark:text-orange-400',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-300 dark:text-yellow-400',
    low: 'bg-green-500/10 text-green-600 border-green-300 dark:text-green-400',
};

const DOC_FILES = [
    '/docs/system-architecture.md',
    '/docs/instance-workflows.md',
    '/docs/auth-and-roles.md',
];

// ─── Issue Report Card ────────────────────────────────────────────────────────

function IssueReportCard({ report }: { report: IssueReport }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(report.claudePrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="mt-3 rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-foreground">{report.title}</span>
                    <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                        SEVERITY_STYLES[report.severity]
                    )}>
                        {report.severity}
                    </span>
                </div>
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
            </div>

            {/* Body */}
            {expanded && (
                <div className="p-4 space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Category</p>
                            <p className="text-foreground">{report.category}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Root Cause</p>
                            <p className="text-foreground">{report.rootCause}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Affected Areas</p>
                        <div className="flex flex-wrap gap-1.5">
                            {report.affectedAreas.map((a, i) => (
                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono">
                                    {a}
                                </span>
                            ))}
                        </div>
                    </div>

                    {report.stepsToReproduce?.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Steps to Reproduce</p>
                            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                                {report.stepsToReproduce.map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                        </div>
                    )}

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Suggested Fix</p>
                        <p className="text-foreground">{report.suggestedFix}</p>
                    </div>
                </div>
            )}

            {/* Claude Prompt Section */}
            <div className="border-t border-border p-4 bg-linear-to-r from-violet-500/5 to-blue-500/5">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Ready-to-Use Claude / ChatGPT Prompt
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopy}
                        className="h-7 text-xs gap-1.5 border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400"
                    >
                        {copied
                            ? <><ClipboardCheck className="h-3 w-3" /> Copied!</>
                            : <><ClipboardCopy className="h-3 w-3" /> Copy Prompt</>
                        }
                    </Button>
                </div>
                <pre className="text-[11px] font-mono text-muted-foreground bg-muted/60 rounded-lg p-3 whitespace-pre-wrap leading-relaxed border border-border max-h-40 overflow-y-auto">
                    {report.claudePrompt}
                </pre>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
    const { user } = useAuthStore();
    const { addToast } = useToast();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Persistence State
    const [chats, setChats] = useState<{ id: string; title: string; updated_at: string }[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);

    // Initial chats fetch
    useEffect(() => {
        if (!user) return;
        api.get('/ai-assistant/chats')
            .then(res => setChats(res.data.data || []))
            .catch(console.error);
    }, [user]);

    const loadChat = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await api.get(`/ai-assistant/chats/${id}`);
            setMessages(res.data.data.messages || []);
            setCurrentChatId(id);
        } catch (e: any) {
            addToast({ title: 'Error', description: 'Failed to load chat', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this chat?')) return;
        try {
            await api.delete(`/ai-assistant/chats/${id}`);
            setChats(prev => prev.filter(c => c.id !== id));
            if (currentChatId === id) {
                setCurrentChatId(null);
                setMessages([]);
            }
        } catch (e: any) {
            addToast({ title: 'Error', description: 'Failed to delete chat', variant: 'destructive' });
        }
    };

    const startNewChat = () => {
        setCurrentChatId(null);
        setMessages([]);
    };

    // Config — no API key needed on frontend anymore (lives in backend .dev.vars)
    const [mode, setMode] = useState<'backend' | 'local'>('backend');
    const [localModel, setLocalModel] = useState('deepseek-r1:8b');
    // docs stored as a map: filename => content (so backend can smart-select)
    const [docs, setDocs] = useState<Record<string, string>>({});
    const [docsLoaded, setDocsLoaded] = useState(false);

    // ── Load docs + saved config ──────────────────────────────────────────────
    useEffect(() => {
        const savedMode = localStorage.getItem('ai_mode') as 'backend' | 'local';
        const savedModel = localStorage.getItem('local_model') ?? 'deepseek-r1:8b';
        if (savedMode) setMode(savedMode);
        setLocalModel(savedModel);

        Promise.all(
            DOC_FILES.map(url =>
                fetch(url)
                    .then(r => r.ok ? r.text() : '')
                    .then(content => ({ filename: url.split('/').pop()!, content }))
            )
        )
            .then(entries => {
                const map: Record<string, string> = {};
                entries.filter(e => e.content).forEach(e => { map[e.filename] = e.content; });
                setDocs(map);
                setDocsLoaded(true);
            })
            .catch(() => setDocsLoaded(true));
    }, []);

    // ── Auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    // ── Core AI call ──────────────────────────────────────────────────────────
    const callAI = useCallback(async (messageHistory: Message[], endpoint: 'chat' | 'report') => {
        if (mode === 'backend') {
            // ─ Use the backend (Groq key stays server-side) ────────────────────
            const res = await api.post(`/ai-assistant/${endpoint}`, {
                messages: messageHistory.map(m => ({ role: m.role, content: m.content })),
                docs,
            });
            const data = res.data;
            const raw: string = endpoint === 'chat' ? data.reply : data.report;
            // For chat, handle DeepSeek-style think blocks just in case
            if (endpoint === 'chat') {
                let thought = '';
                let content = raw as string;
                const thinkMatch = (raw as string).match(/<think>([\s\S]*?)<\/think>/i);
                if (thinkMatch) {
                    thought = thinkMatch[1].trim();
                    content = (raw as string).replace(/<think>[\s\S]*?<\/think>/i, '').trim();
                }
                return { content, thought, report: undefined };
            }
            // For report, the backend already returns a parsed object
            return { content: '', thought: '', report: raw as unknown as IssueReport };
        } else {
            // ─ Local Ollama fallback ────────────────────────────────────────────
            const flatDocs = Object.entries(docs).map(([k, v]) => `=== ${k} ===\n${v}`).join('\n\n');
            const systemPrompt = endpoint === 'chat'
                ? `You are the FMS Platform Expert. Use this documentation:\n${flatDocs}`
                : `You are a senior FMS engineer. Generate a JSON issue report from this conversation.\nDocumentation:\n${flatDocs}\nRespond ONLY with valid JSON.`;
            const body = {
                model: localModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messageHistory.map(m => ({ role: m.role, content: m.content })),
                ],
                stream: false,
            };
            if (endpoint === 'report') {
                body.messages.push({ role: 'user', content: 'Generate the JSON issue report now.' });
            }
            const res = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Ollama request failed. Is it running?');
            const data = await res.json();
            const raw: string = data.message.content;
            if (endpoint === 'chat') {
                let thought = '';
                let content = raw;
                const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
                if (thinkMatch) {
                    thought = thinkMatch[1].trim();
                    content = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
                }
                return { content, thought, report: undefined };
            }
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Local model did not return valid JSON.');
            return { content: '', thought: '', report: JSON.parse(jsonMatch[0]) as IssueReport };
        }
    }, [mode, docs, localModel]);

    // ── Send chat message ─────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input.trim() };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setIsLoading(true);

        try {
            const { content, thought } = await callAI(newHistory, 'chat');
            const finalHistory = [...newHistory, { role: 'assistant' as const, content, thought }];
            setMessages(finalHistory);

            // Save to Database
            if (currentChatId) {
                await api.put(`/ai-assistant/chats/${currentChatId}`, { messages: finalHistory });
                setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, updated_at: new Date().toISOString() } : c));
            } else {
                const res = await api.post('/ai-assistant/chats', { messages: finalHistory });
                const newChat = res.data.data;
                setCurrentChatId(newChat.id);
                setChats(prev => [newChat, ...prev]);
            }

        } catch (e: any) {
            addToast({ title: 'AI Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    // ── Generate Issue Report ─────────────────────────────────────────────────
    const handleGenerateReport = async () => {
        if (messages.length === 0 || isGeneratingReport) return;
        setIsGeneratingReport(true);

        try {
            const { report } = await callAI(messages, 'report');
            if (!report) throw new Error('No report was generated. Please try again.');

            let updatedForReport: Message[] = [];
            setMessages(prev => {
                const updated = [...prev];
                const lastAssistantIdx = [...updated].map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
                if (lastAssistantIdx !== undefined) {
                    updated[lastAssistantIdx] = { ...updated[lastAssistantIdx], issueReport: report };
                } else {
                    updated.push({ role: 'assistant', content: 'Issue report generated:', issueReport: report });
                }
                updatedForReport = updated;
                return updated;
            });

            if (currentChatId && updatedForReport.length > 0) {
                api.put(`/ai-assistant/chats/${currentChatId}`, { messages: updatedForReport }).catch(console.error);
            }

            addToast({ title: 'Report Ready', description: 'Copy the Claude prompt and paste it to get the fix.', variant: 'success' });
        } catch (e: any) {
            addToast({ title: 'Report Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleSaveSettings = () => {
        localStorage.setItem('ai_mode', mode);
        localStorage.setItem('local_model', localModel);
        addToast({ title: 'Settings Saved', description: 'Configuration updated.', variant: 'success' });
    };

    const hasMessages = messages.length > 0;
    // Backend mode is always ready (key is on server). Local mode needs ollama running.
    const canSend = !isLoading && input.trim().length > 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background flex flex-col p-6 max-w-[1400px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Bot className="text-primary h-5 w-5" />
                        </div>
                        Platform Intelligence
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 ml-10">
                        Diagnose issues · Generate fix prompts for Claude & ChatGPT
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                        "px-3 py-1 gap-1.5 text-xs font-semibold",
                        mode === 'backend'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:text-emerald-400'
                            : 'bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400'
                    )}>
                        {mode === 'backend' ? <Server className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                        {mode === 'backend' ? 'Backend: Groq (Secure)' : `Ollama: ${localModel}`}
                    </Badge>
                    {hasMessages && (
                        <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-muted-foreground h-8 w-8 p-0">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-6 flex-1 items-start">

                {/* ─── LEFT SIDEBAR: CHAT HISTORY ──────────────────────────── */}
                <Card className="w-64 shrink-0 flex flex-col border-border bg-card/50 h-[calc(100vh-140px)] p-4">
                    <Button onClick={startNewChat} className="w-full justify-start gap-2 mb-4" variant="default">
                        <MessageSquare className="h-4 w-4" /> New Diagnosis
                    </Button>
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                        Recent Chats
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                        {chats.length === 0 && (
                            <p className="text-xs text-muted-foreground px-1 py-2 italic font-medium opacity-70">No past chats.</p>
                        )}
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => loadChat(chat.id)}
                                className={cn(
                                    "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                                    currentChatId === chat.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                                )}
                            >
                                <span className="truncate">{chat.title}</span>
                                <button
                                    onClick={(e) => handleDeleteChat(chat.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all shrink-0"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* ─── RIGHT PANEL: MAIN CHAT AREA ─────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 h-[calc(100vh-140px)]">
                    <Tabs defaultValue="chat" className="flex flex-col gap-4 flex-1 h-full">
                        <TabsList className="w-fit">
                            <TabsTrigger value="chat" className="gap-1.5 text-xs">
                                <MessageSquare className="h-3.5 w-3.5" /> Assistant
                            </TabsTrigger>
                            <TabsTrigger value="settings" className="gap-1.5 text-xs">
                                <SettingsIcon className="h-3.5 w-3.5" /> Configuration
                            </TabsTrigger>
                            <TabsTrigger value="kb" className="gap-1.5 text-xs">
                                <BookOpen className="h-3.5 w-3.5" /> Knowledge Base
                            </TabsTrigger>
                        </TabsList>

                        {/* ─── CHAT TAB ─────────────────────────────────────────────── */}
                        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0">

                            <Card className="flex flex-col flex-1 overflow-hidden border-border bg-card/50">

                                {/* Messages */}
                                <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
                                    {!hasMessages && (
                                        <div className="flex flex-col items-center justify-center text-center py-24 opacity-40 select-none">
                                            <Bot className="h-14 w-14 mb-3 text-primary" />
                                            <h3 className="text-lg font-semibold">Describe your platform issue</h3>
                                            <p className="text-sm max-w-xs mt-2 text-muted-foreground">
                                                I'll diagnose it using your platform docs and generate a ready-to-use fix prompt for Claude or ChatGPT.
                                            </p>
                                            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
                                                {[
                                                    'Why is a task stuck in LOCKED status?',
                                                    'A user cannot see their company dashboard',
                                                    'Instance creation is failing silently',
                                                ].map(q => (
                                                    <button
                                                        key={q}
                                                        onClick={() => setInput(q)}
                                                        className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground"
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {messages.map((m, i) => (
                                        <div key={i} className={cn("flex gap-3", m.role === 'user' ? 'justify-end' : 'justify-start')}>
                                            {m.role === 'assistant' && (
                                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 mt-1">
                                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                                </div>
                                            )}
                                            <div className={cn("max-w-[82%] flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>

                                                {/* Thinking block */}
                                                {m.thought && (
                                                    <div className="border-l-2 border-primary/30 py-2 px-3 rounded-r-lg bg-muted/20 text-[11px] italic text-muted-foreground w-full">
                                                        <p className="flex items-center gap-1 font-bold mb-1 not-italic opacity-60">
                                                            <Cpu className="h-3 w-3" /> Reasoning
                                                        </p>
                                                        {m.thought}
                                                    </div>
                                                )}

                                                {/* Main bubble */}
                                                <div className={cn(
                                                    "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                                                    m.role === 'user'
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted text-foreground border border-border shadow-sm'
                                                )}>
                                                    {m.content}
                                                </div>

                                                {/* Issue Report if attached */}
                                                {m.issueReport && <IssueReportCard report={m.issueReport} />}
                                            </div>

                                            {m.role === 'user' && (
                                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border mt-1">
                                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {(isLoading || isGeneratingReport) && (
                                        <div className="flex gap-3">
                                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center animate-pulse border border-primary/20">
                                                <Bot className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <div className="text-sm text-muted-foreground italic flex items-center gap-2 py-2">
                                                <div className="flex gap-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                                                </div>
                                                {isGeneratingReport ? 'Generating issue report...' : 'Analyzing your platform...'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input Area */}
                                <div className="border-t border-border p-4 bg-card space-y-3">
                                    {/* Generate Report Button */}
                                    {hasMessages && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleGenerateReport}
                                            disabled={isLoading || isGeneratingReport}
                                            className="w-full gap-2 border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30 h-9"
                                        >
                                            <FileText className="h-4 w-4" />
                                            {isGeneratingReport ? 'Generating...' : 'Generate Issue Report & Claude Prompt'}
                                            <Sparkles className="h-3.5 w-3.5 opacity-60" />
                                        </Button>
                                    )}

                                    {/* Text Input */}
                                    <div className="relative">
                                        <Textarea
                                            // placeholder={
                                            //     mode === 'cloud' && !hasGroqKey
                                            //         ? 'Add Groq API key in Configuration to start...'
                                            //         : 'Describe the issue you are facing... (Enter to send, Shift+Enter for new line)'
                                            // }
                                            placeholder='Enter the issue you are facing...'
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            disabled={isGeneratingReport}
                                        // className="min-h-[72px] bg-muted/60 border-muted focus-visible:ring-primary pl-4 pr-12 pt-3 resize-none rounded-xl text-sm"
                                        />
                                        <Button
                                            size="sm"
                                            className="absolute bottom-2.5 right-2.5 h-7 w-7 p-0 rounded-lg"
                                            onClick={handleSend}
                                            disabled={!canSend}
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings" className="flex-1 flex flex-col min-h-0">
                            <Card className="p-8 flex-1 overflow-y-auto border-border bg-card/50 custom-scrollbar">
                                <div className="max-w-2xl space-y-6">
                                    <h2 className="text-lg font-bold mb-2">AI Configuration</h2>
                                    <p className="text-xs text-muted-foreground mb-6">
                                        The Groq API key is securely stored in the backend server — it is never exposed to the browser.
                                    </p>
                                    <div className="space-y-6">
                                        {/* Mode Selection */}
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">
                                                Assistant Mode
                                            </label>
                                            <div className="grid grid-cols-2 gap-4">
                                                {[
                                                    { id: 'backend' as const, icon: Server, title: 'Backend (Groq)', sub: 'Recommended. Key stays on the server. Fast & secure.' },
                                                    { id: 'local' as const, icon: Cpu, title: 'Local (Ollama)', sub: 'Fully private. Runs DeepSeek on your own machine.' },
                                                ].map(({ id, icon: Icon, title, sub }) => (
                                                    <div
                                                        key={id}
                                                        onClick={() => setMode(id)}
                                                        className={cn(
                                                            "p-4 rounded-xl border-2 cursor-pointer transition-all",
                                                            mode === id ? 'border-primary bg-primary/5' : 'border-border bg-muted/10 hover:bg-muted/20'
                                                        )}
                                                    >
                                                        <Icon className={cn("h-5 w-5 mb-2", mode === id ? 'text-primary' : 'text-muted-foreground')} />
                                                        <p className="font-semibold text-sm">{title}</p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Backend info */}
                                        {mode === 'backend' && (
                                            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900 animate-in fade-in slide-in-from-top-2">
                                                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                    Using <strong>GROQ_API_KEY</strong> from your Cloudflare Worker environment.
                                                    Model: <strong>llama-3.3-70b-versatile</strong>. No browser configuration needed.
                                                </p>
                                            </div>
                                        )}

                                        {/* Local Model */}
                                        {mode === 'local' && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ollama Model Name</label>
                                                <Input
                                                    placeholder="deepseek-r1:8b"
                                                    value={localModel}
                                                    onChange={e => setLocalModel(e.target.value)}
                                                    className="font-mono"
                                                />
                                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-200 dark:border-blue-900">
                                                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                                                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                        Ensure Ollama is running locally. Pull model with:{' '}
                                                        <code className="font-mono font-bold">ollama run {localModel}</code>
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2 flex justify-between items-center border-t border-border">
                                            <p className="text-[11px] text-muted-foreground">Mode preference saved locally in your browser.</p>
                                            <Button onClick={handleSaveSettings}>Save Configuration</Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </TabsContent>

                        {/* ─── KNOWLEDGE BASE TAB ───────────────────────────────────── */}
                        <TabsContent value="kb" className="flex-1 flex flex-col min-h-0">
                            <Card className="p-6 flex-1 flex flex-col overflow-hidden border-border bg-card/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                    <h2 className="text-lg font-bold">Integrated Knowledge Base</h2>
                                    <Badge variant="outline" className="ml-auto text-xs">
                                        {docsLoaded ? <><CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Loaded</> : 'Loading...'}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">
                                    These documentation files are automatically injected into every AI query. The AI can only answer based on this knowledge.
                                </p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {DOC_FILES.map(f => (
                                        <span key={f} className="text-[11px] font-mono px-2 py-1 rounded bg-muted border border-border text-muted-foreground">
                                            {f.split('/').pop()}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                    {Object.keys(docs).length > 0 ? (
                                        Object.entries(docs).map(([filename, content]) => (
                                            <div key={filename} className="bg-muted rounded-xl border border-border overflow-hidden">
                                                <div className="bg-muted-foreground/10 px-4 py-2 border-b border-border flex items-center gap-2 font-mono text-xs font-bold text-muted-foreground">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    {filename}
                                                </div>
                                                <pre className="p-4 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                                                    {content}
                                                </pre>
                                            </div>
                                        ))
                                    ) : (
                                        <pre className="p-4 bg-muted rounded-xl text-[11px] font-mono text-muted-foreground border border-border">
                                            Loading documentation files from /public/docs/...
                                        </pre>
                                    )}
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
