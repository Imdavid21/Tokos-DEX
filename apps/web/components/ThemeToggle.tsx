"use client";
import {Moon} from "lucide-react";
export function ThemeToggle(){function flip(){const root=document.documentElement;const dark=root.dataset.theme==="dark";root.dataset.theme=dark?"light":"dark";localStorage.setItem("tokos-data-theme",dark?"light":"dark")}return <button className="icon-btn" onClick={flip} aria-label="Toggle color theme"><Moon size={15}/></button>}
