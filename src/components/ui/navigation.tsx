
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './button';
import { Home, BookOpen, Phone, Info } from 'lucide-react';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from './navigation-menu';
import { cn } from '@/lib/utils';

export function MainNavigation() {
  const navigate = useNavigate();
  
  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <Button variant="link" onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Button variant="link" onClick={() => navigate('/dashboard')}>
            <BookOpen className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Button variant="link" onClick={() => navigate('/contact')}>
            <Phone className="mr-2 h-4 w-4" />
            Contact
          </Button>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Button variant="link" onClick={() => navigate('/legal')}>
            <Info className="mr-2 h-4 w-4" />
            Legal
          </Button>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function MobileNavigation() {
  const navigate = useNavigate();
  
  return (
    <div className="flex md:hidden space-x-1">
      <Button variant="outline" size="sm" onClick={() => navigate('/')}>
        <Home className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
        <BookOpen className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigate('/contact')}>
        <Phone className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigate('/legal')}>
        <Info className="h-4 w-4" />
      </Button>
    </div>
  );
}
