import { Component, afterNextRender, afterRender, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// PrimeNG Modules
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

// Services
import { AppService } from 'src/app/services/app.service';

// Interfaces
import { IRegister } from 'src/app/interfaces/register.interface';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  providers: [MessageService]
})
export class RegisterComponent {
  usuario: IRegister = { email: '', password: '' };
  registrationError: string | null = null;

  private destroyRef = effect(() => {
    // Reactive effect that will run when dependencies change
    // This can be used for reactive state management
    return () => {
      // Cleanup function for the effect
    };
  });

  private readonly appService = inject(AppService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  constructor() {
    // Use afterNextRender for one-time initialization after the component is created
    afterNextRender(() => {
      // Any one-time initialization code can go here
      console.log('Register component initialized');
    });

    // Use afterRender for DOM-dependent operations
    afterRender(() => {
      // This will run after every change detection cycle
      // Can be used for DOM measurements or other operations that need the view to be stable
    });
  }

  onSubmit(form: any) {
    if (!form) return;
    
    if (form.valid) {
      this.appService.register(this.usuario).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Registration successful',
            detail: 'User successfully registered',
          });

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500); // Wait 1.5 seconds before redirecting
        },
        error: (err) => {
          console.error('Error registering user:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Registration error',
            detail: 'The user could not be registered. Please try again.',
          });
        },
      });
    }
  }
}
