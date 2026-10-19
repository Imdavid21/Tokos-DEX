"use client";
import {Sun} from "lucide-react";
export function ThemeToggle(){function flip(){const root=document.documentElement;const light=root.dataset.theme==="light";root.dataset.theme=light?"dark":"light";try{localStorage.setItem("indenture-theme",light?"dark":"light")}catch{}}return <button className="icon-btn" onClick={flip} aria-label="Toggle color theme" title="Toggle light / dark"><Sun size={14}/></button>}
