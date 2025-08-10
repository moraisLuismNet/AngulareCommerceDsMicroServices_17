import { Component, inject, OnDestroy, afterNextRender, afterRender, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// PrimeNG Modules
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

// Services
import { AppService } from 'src/app/services/app.service';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { UserService } from 'src/app/services/user.service';

// Interfaces
import { ILogin, ILoginResponse } from 'src/app/interfaces/login.interface';

// Third-party
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  providers: [MessageService],
})
export class LoginComponent implements OnDestroy {
  infoLogin: ILogin = {
    email: '',
    password: '',
    role: '',
  };

  private destroyRef = effect(() => {
    // Reactive effect that will run when dependencies change
    // This can be used for reactive state management
    return () => {
      // Cleanup function for the effect
    };
  });

  private readonly router = inject(Router);
  private readonly appService = inject(AppService);
  private readonly messageService = inject(MessageService);
  private readonly authGuard = inject(AuthGuard);
  private readonly userService = inject(UserService);

  constructor() {
    // Use afterNextRender for one-time initialization after the component is created
    afterNextRender(() => {
      this.userService.setEmail(this.infoLogin.email);
      if (this.authGuard.isLoggedIn()) {
        this.router.navigateByUrl('/ecommerce/listgroups');
      }
    });

    // Use afterRender for DOM-dependent operations
    afterRender(() => {
      // This will run after every change detection cycle
      // Can be used for DOM measurements or other operations that need the view to be stable
    });
  }

  ngOnDestroy() {
    // Cleanup logic here
    // The destroyRef will automatically clean up the effect when the component is destroyed
  }

  login() {
    this.appService.login(this.infoLogin).subscribe({
      next: (data: ILoginResponse) => {
        const decodedToken: any = jwtDecode(data.token);
        const role = decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
        const email = this.infoLogin.email;
        
        const userData = { 
          ...data, 
          role, 
          email,
          name: email.split('@')[0] 
        };
        
        sessionStorage.setItem('user', JSON.stringify(userData));
        
        this.userService.setEmail(email);
        this.userService.setRole(role);
        
        // Redirect based on role
        this.userService.redirectBasedOnRole();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Incorrect credentials',
        });
      },
    });
  }
}
