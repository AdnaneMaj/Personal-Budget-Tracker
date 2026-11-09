import {
  Utensils,
  Shirt,
  Home,
  Wifi,
  Bus,
  HeartPulse,
  Users,
  Film,
  Car,
  Ellipsis,
  Briefcase,
  Gift,
  Wallet,
} from "lucide-react";
const icons = {
  food: Utensils,
  utensils: Utensils,
  clothes: Shirt,
  shirt: Shirt,
  rent: Home,
  home: Home,
  wifi: Wifi,
  transport: Bus,
  bus: Bus,
  health: HeartPulse,
  "heart-pulse": HeartPulse,
  family: Users,
  users: Users,
  entertainment: Film,
  film: Film,
  car: Car,
  divers: Ellipsis,
  paycheck: Briefcase,
  bonus: Gift,
  other: Wallet,
};
export default function CategoryIcon({ category, icon }) {
  const name = typeof category === "object" ? category.name : category;
  const storedIcon = typeof category === "object" ? category.icon : icon;
  const Icon = icons[storedIcon] || icons[name] || Ellipsis;
  return <Icon size={16} strokeWidth={1.7} aria-hidden="true" />;
}
