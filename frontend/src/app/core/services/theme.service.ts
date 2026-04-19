import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(this.loadPreference());
  isDark$ = this.darkMode.asObservable();

  get isDark(): boolean { return this.darkMode.value; }

  constructor() {
    this.applyTheme(this.darkMode.value);
  }

  toggle(): void {
    const next = !this.darkMode.value;
    this.darkMode.next(next);
    this.applyTheme(next);
    localStorage.setItem('cdmi-theme', next ? 'dark' : 'light');
  }

  private loadPreference(): boolean {
    const saved = localStorage.getItem('cdmi-theme');
    if (saved) return saved === 'dark';
    return true; // default dark
  }

  private applyTheme(dark: boolean): void {
    const el = document.documentElement;
    if (dark) {
      el.classList.add('dark-mode');
    } else {
      el.classList.remove('dark-mode');
    }
  }
}
