const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "The groundwork for all happiness is good health.", author: "Leigh Hunt" },
  { text: "To keep the body in good health is a duty, otherwise we shall not be able to keep our mind strong and clear.", author: "Buddha" },
  { text: "A year from now you will wish you had started today.", author: "Karen Lamb" },
  { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Don't wish for it. Work for it.", author: "Unknown" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The difference between try and triumph is a little 'umph'.", author: "Marvin Phillips" },
  { text: "Strength does not come from the body. It comes from the will of the soul.", author: "Mahatma Gandhi" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { text: "What seems impossible today will one day become your warm-up.", author: "Unknown" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "You are one workout away from a good mood.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Every step forward is a step in the right direction.", author: "Unknown" },
  { text: "Health is not about the weight you lose, but about the life you gain.", author: "Unknown" },
  { text: "You don't have to be perfect to be amazing.", author: "Unknown" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "Your future self is watching you right now through your memories.", author: "Aubrey De Grey" },
  { text: "Eat well, move often, sleep deeply.", author: "Unknown" },
  { text: "The body achieves what the mind believes.", author: "Unknown" },
  { text: "When you feel like quitting, think about why you started.", author: "Unknown" },
];

export function DailyQuote() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const quote = QUOTES[dayOfYear % QUOTES.length];

  return (
    <div className="rounded-xl border bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 px-5 py-4">
      <p className="text-sm font-medium leading-relaxed text-foreground">
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="text-xs text-muted-foreground mt-1.5">— {quote.author}</p>
    </div>
  );
}
