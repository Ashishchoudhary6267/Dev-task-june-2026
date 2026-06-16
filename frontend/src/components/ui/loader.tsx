import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/zustand/user/user';
import { QUOTES } from '@/lib/quotes';

const Loader = () => {
    const { user } = useAuthStore();
    const [progress, setProgress] = useState(0);
    const [quote, setQuote] = useState("");

    useEffect(() => {
        // 1. Determine the user's role (fallback to 'default' or 'member' if unknown)
        const rawRole = user?.platform_role?.toLowerCase() || 'default';

        // Map common variations to our quote keys
        let roleKey = 'default';
        if (rawRole.includes('admin')) roleKey = 'admin';
        else if (rawRole.includes('controller') || rawRole.includes('approver')) roleKey = 'controller';
        else if (rawRole.includes('member') || rawRole.includes('worker') || rawRole.includes('user')) roleKey = 'member';

        const roleQuotes = QUOTES[roleKey] || QUOTES.default;

        // 2. Select a random quote
        const randomQuote = roleQuotes[Math.floor(Math.random() * roleQuotes.length)];
        setQuote(randomQuote);

        // 3. Progress animation
        const interval = setInterval(() => {
            setProgress((oldProgress) => {
                if (oldProgress < 50) return oldProgress + Math.random() * 15;
                else if (oldProgress < 85) return oldProgress + Math.random() * 5;
                else if (oldProgress < 95) return oldProgress + Math.random() * 1;
                return oldProgress;
            });
        }, 200);

        return () => clearInterval(interval);
    }, [user?.platform_role]);

    const displayProgress = Math.floor(Math.min(progress, 99));

    return (
        <div className="bg-gray-50 dark:bg-gray-900/10 rounded-2xl p-12 flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 w-full transition-all duration-500">

            {/* Progress Bar Background */}
            <div className="w-full max-w-sm bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mb-8 overflow-hidden shadow-inner">
                <div
                    className="bg-primary h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                    style={{ width: `${displayProgress}%` }}
                />
            </div>

            {/* Quote Container with Entrance Animation */}
            <div className="text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
                <p className="text-xl font-serif text-gray-700 dark:text-gray-300 italic mb-3 leading-relaxed tracking-tight">
                    "{quote.split(' — ')[0]}"
                </p>
                <div className="flex items-center justify-center gap-3">
                    <div className="h-px w-8 bg-gray-300 dark:bg-gray-700" />
                    <p className="text-xs font-bold text-primary tracking-widest uppercase opacity-80">
                        {quote.split(' — ')[1] || "Inspiring Thought"}
                    </p>
                    <div className="h-px w-8 bg-gray-300 dark:bg-gray-700" />
                </div>
            </div>

            <p className="mt-8 text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase opacity-50 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary animate-ping" />
                Loading resources... {displayProgress}%
            </p>
        </div>
    );
}

export default Loader;



// if animated is required
// import React, { useState, useEffect } from 'react';

// const Loader = () => {
//     const [progress, setProgress] = useState(0);
//     const [isVisible, setIsVisible] = useState(false);

//     useEffect(() => {
//     // Trigger entrance animation immediately on mount
//     requestAnimationFrame(() => setIsVisible(true));

//     const interval = setInterval(() => {
//         setProgress((oldProgress) => {
//             // 1. Initial burst (Fast)
//             if (oldProgress < 50) return oldProgress + Math.random() * 15;
//             // 2. Slowing down midway
//             else if (oldProgress < 85) return oldProgress + Math.random() * 5;
//             // 3. Crawling / Waiting near the end for the real response
//             else if (oldProgress < 95) return oldProgress + Math.random() * 1;
//             // Cap it at ~95%
//             return oldProgress;
//         });
//     }, 200);

//     return () => clearInterval(interval);
// }, []);

// Ensure we don't display decimals or go above 99% visually while loading
// const displayProgress = Math.floor(Math.min(progress, 99));

// return (
//     <div 
//         className={`fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md transition-all duration-500 ease-out ${
//             isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
//         }`}
//     >
//         <div 
//             className={`bg-card rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center justify-center border border-border transition-all duration-500 ease-out transform ${
//                 isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'
//             }`}
//         >
{/* Glowing Icon Container */ }
{/* <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                    <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center relative animate-pulse">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-1">Loading</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center">
                    Please wait a moment...
                </p> */}

{/* Progress Bar Background */ }
{/* <div className="w-full bg-secondary rounded-full h-2 mb-2 overflow-hidden"> */ }
{/* Animated Fill */ }
{/* <div
                        className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${displayProgress}%` }}
                    />
                </div> */}

{/* Progress Text */ }
{/* <div className="flex justify-between w-full text-xs font-medium text-muted-foreground">
                    <span className="animate-pulse">Fetching resources</span>
                    <span className="tabular-nums text-primary font-bold">{displayProgress}%</span>
                </div>
            </div>
        </div>
    );
}

export default Loader; */}

