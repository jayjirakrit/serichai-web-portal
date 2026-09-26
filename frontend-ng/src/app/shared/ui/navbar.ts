import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  template: `
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <a class="font-semibold text-xl text-primary pl-6 cursor-pointer" routerLink="/">Serichai Web Portal</a>
      </div>
      <div class="flex gap-2">
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar" aria-label="Account menu">
            <div class="w-10 rounded-full bg-gray-200"></div>
          </div>
          <ul
            tabindex="-1"
            class="menu menu-sm dropdown-content z-1 mt-3 w-52 p-2 rounded-box bg-base-100 shadow"
          >
            <li>
              <a class="justify-between">
                Profile
                <span class="badge">New</span>
              </a>
            </li>
            <li><a>Settings</a></li>
            <li><a>Logout</a></li>
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class Navbar {}
