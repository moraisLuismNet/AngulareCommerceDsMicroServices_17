import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar/navbar.component';
import { RouterModule } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { RegisterComponent } from './register/register.component';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BadgeModule } from 'primeng/badge';

@NgModule({
  declarations: [], // All components are now standalone
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ToastModule,
    TableModule,
    ButtonModule,
    ConfirmDialogModule,
    BadgeModule,
    NavbarComponent,   // Import standalone NavbarComponent
    LoginComponent,    // Import standalone LoginComponent
    RegisterComponent  // Import standalone RegisterComponent
  ],
  exports: [
    NavbarComponent,   // Export standalone NavbarComponent
    LoginComponent,    // Export standalone LoginComponent
    RegisterComponent  // Export standalone RegisterComponent
  ],
  providers: [MessageService],
})
export class SharedModule {}
