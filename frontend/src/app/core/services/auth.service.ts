import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { BehaviorSubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  constructor(private api: ApiService, private router: Router) {
    this.loadUser();
  }

  get user() { return this.userSubject.value; }
  get isLoggedIn() { return !!localStorage.getItem('token'); }

  private loadUser() {
    if (this.isLoggedIn) {
      this.api.get<any>('/auth/me').subscribe({
        next: (user) => this.userSubject.next(user),
        error: () => this.logout(),
      });
    }
  }

  login(email: string, password: string) {
    return this.api.post<any>('/auth/login', { email, password }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('clientMode', 'management');
        this.userSubject.next(res.user);
      }),
    );
  }

  loginPin(pin: string) {
    return this.api.post<any>('/auth/login-pin', { pin }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('clientMode', 'production');
        this.userSubject.next(res.user);
      }),
    );
  }

  loginCard(card_id: string) {
    return this.api.post<any>('/auth/login-card', { card_id }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('clientMode', 'production');
        this.userSubject.next(res.user);
      }),
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('clientMode');
    this.userSubject.next(null);
    this.router.navigate(['/']);
  }
}
