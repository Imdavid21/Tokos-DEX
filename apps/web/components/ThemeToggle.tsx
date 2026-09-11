"use client";
import {Moon,Sun} from "lucide-react";
export function ThemeToggle(){function flip(){const root=document.documentElement;const dark=root.dataset.theme==="dark";root.dataset.theme=dark?"light":"dark";localStorage.setItem("tokos-data-theme",dark?"light":"dark")}return <button className="icon-btn theme-toggle" onClick={flip} aria-label="Toggle color theme"><span className="theme-icon theme-icon-light"><Moon size={15}/></span><span className="theme-icon theme-icon-dark"><Sun size={15}/></span></button>}
