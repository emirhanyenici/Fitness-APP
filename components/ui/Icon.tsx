/**
 * Single entry point for app icons (finding T1 — replaces the emoji/text-glyph
 * "icon system"). Rules:
 *  - Vector icons only (lucide), tinted with design tokens — never emoji.
 *  - Three sizes: sm 16 / md 20 / lg 24 (numeric override only for hero art).
 *  - One stroke weight app-wide (1.75).
 * Import icons from THIS module, not from 'lucide-react-native' directly, so
 * the icon vocabulary stays curated and swappable in one place.
 */
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';
import { colors } from '../../constants/colors';

export type IconComponent = ComponentType<LucideProps>;

export const iconSizes = { sm: 16, md: 20, lg: 24 } as const;
export type IconSize = keyof typeof iconSizes;

const STROKE_WIDTH = 1.75;

interface IconProps {
  icon: IconComponent;
  /** 'sm' 16 / 'md' 20 / 'lg' 24, or a number for special cases (hero art) */
  size?: IconSize | number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ icon: I, size = 'md', color = colors.text.primary, strokeWidth = STROKE_WIDTH }: IconProps) {
  const px = typeof size === 'number' ? size : iconSizes[size];
  return <I size={px} color={color} strokeWidth={strokeWidth} />;
}

import {
  Dumbbell as _Dumbbell, Flame as _Flame, Zap as _Zap, Activity as _Activity,
  PersonStanding as _PersonStanding, NotebookPen as _NotebookPen,
  UtensilsCrossed as _UtensilsCrossed, Moon as _Moon, Footprints as _Footprints,
  Layers as _Layers, Waves as _Waves,
} from 'lucide-react-native';

/**
 * Workout history rows store the program's emoji in CompletedWorkout.icon
 * (persisted data — can't be migrated retroactively). Map stored emoji →
 * vector icon at render time; unknown values fall back to Dumbbell.
 */
const WORKOUT_EMOJI_ICONS: Record<string, IconComponent> = {
  '🏋️': _Dumbbell,       // full body / chest
  '💪': _Dumbbell,        // upper-lower / arms
  '🔥': _Flame,           // push-pull-legs / core
  '⚡': _Zap,             // bro split
  '🏃': _Activity,        // cardio & core
  '🧘': _PersonStanding,  // yoga & mobility
  '✏️': _NotebookPen,     // custom program
  '🍽️': _UtensilsCrossed,
  '🌙': _Moon,
  '🦵': _Footprints,     // legs (custom-program group)
  '🧗': _Layers,          // back (custom-program group)
  '🏊': _Waves,           // shoulders (custom-program group)
};

export function workoutIcon(emoji: string): IconComponent {
  return WORKOUT_EMOJI_ICONS[emoji] ?? _Dumbbell;
}

// Curated icon vocabulary — add here as screens need them.
export {
  // Tab bar
  Home, Salad, Dumbbell, MoonStar, CircleUserRound,
  // Home screen
  Footprints, Flame, Zap, Target, TrendingUp, MessageCircle, Moon, Apple,
  ClipboardCheck, Sparkles,
  // Navigation / chrome
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp, X, ArrowLeft, ArrowUp,
  Check, Plus, Minus, Pencil, Send, Trash2, Search, Camera, Keyboard,
  ScanBarcode, Eye, EyeOff,
  // Profile / settings
  Ruler, Globe, Bell, ChartColumn, Heart, CreditCard, Stethoscope, Lock,
  FileText, Crown,
  // Nutrition
  Droplets, Coffee, Sun, UtensilsCrossed, Cookie,
  // Workout / recovery
  Activity, HeartPulse, Bed, Timer, Trophy, Calendar, Scale, Brain, Wind,
  Bike, PersonStanding, Battery, History, NotebookPen, Lightbulb, Info,
  CircleCheck, Star, Watch, RefreshCw, Layers,
  // Recovery rating endpoints
  Frown, Smile, Angry, Leaf,
  // Exercise demo metadata
  MapPin, Wrench,
  // Photo picker (renamed to avoid clashing with react-native's Image)
  Image as ImageIcon,
} from 'lucide-react-native';
