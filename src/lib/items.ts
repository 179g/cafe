// src/lib/items.ts

export interface SnackItem {
  id: string;
  name: string;
  emoji: string;
  category: "drink" | "food" | "sweet";
  hot?: boolean; // shows steam animation
}

export const SNACKS: SnackItem[] = [
  // Hot drinks
  { id: "coffee", name: "コーヒー", emoji: "☕", category: "drink", hot: true },
  { id: "tea", name: "紅茶", emoji: "🍵", category: "drink", hot: true },
  { id: "cocoa", name: "ホットココア", emoji: "🫖", category: "drink", hot: true },
  { id: "latte", name: "カフェラテ", emoji: "🧋", category: "drink", hot: true },
  // Cold drinks
  { id: "juice", name: "オレンジジュース", emoji: "🍊", category: "drink" },
  { id: "soda", name: "コーラ", emoji: "🥤", category: "drink" },
  { id: "water", name: "お水", emoji: "💧", category: "drink" },
  // Food
  { id: "sandwich", name: "サンドイッチ", emoji: "🥪", category: "food" },
  { id: "onigiri", name: "おにぎり", emoji: "🍙", category: "food" },
  { id: "pizza", name: "ピザ", emoji: "🍕", category: "food" },
  // Sweets
  { id: "cake", name: "ケーキ", emoji: "🍰", category: "sweet" },
  { id: "cookie", name: "クッキー", emoji: "🍪", category: "sweet" },
  { id: "candy", name: "キャンディ", emoji: "🍬", category: "sweet" },
  { id: "chocolate", name: "チョコ", emoji: "🍫", category: "sweet" },
  { id: "donut", name: "ドーナツ", emoji: "🍩", category: "sweet" },
  { id: "icecream", name: "アイス", emoji: "🍦", category: "sweet" },
];

export interface ReactionItem {
  id: string;
  name: string;
  emoji: string;
  animationType: "confetti" | "projectile" | "balloon" | "patrol";
}

export const REACTIONS: ReactionItem[] = [
  { id: "cracker", name: "クラッカー", emoji: "🎊", animationType: "confetti" },
  { id: "stone", name: "石", emoji: "🪨", animationType: "projectile" },
  { id: "balloon", name: "風船", emoji: "🎈", animationType: "balloon" },
  { id: "police", name: "パトカー", emoji: "🚔", animationType: "patrol" },
];
