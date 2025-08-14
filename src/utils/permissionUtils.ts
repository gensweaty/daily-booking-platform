export interface UserContext {
  id?: string;
  email?: string;
  fullname?: string;
  isAuthenticated: boolean;
  isSubUser: boolean;
  isPublicMode: boolean;
  publicUserName?: string;
  publicUserEmail?: string;
}

export interface ItemMetadata {
  created_by_type?: string;
  created_by_name?: string;
  last_edited_by_type?: string;
  last_edited_by_name?: string;
  user_id?: string;
}

/**
 * Unified permission checker for both authenticated sub-users and public board external users
 */
export const canEditDeleteItem = (userContext: UserContext, itemMetadata: ItemMetadata, boardOwnerId?: string): boolean => {
  console.log('🔍 Permission check:', { userContext, itemMetadata, boardOwnerId });

  // Admin users can edit/delete everything
  if (userContext.isAuthenticated && !userContext.isSubUser) {
    console.log('✅ Admin user - full permissions');
    return true;
  }

  // For public mode (external users via public board link)
  if (userContext.isPublicMode && userContext.publicUserName) {
    const canEdit = (
      // Created by this external user
      (itemMetadata.created_by_type === 'external_user' && itemMetadata.created_by_name?.includes(userContext.publicUserName)) ||
      (itemMetadata.created_by_type === 'sub_user' && itemMetadata.created_by_name === userContext.publicUserName) ||
      // Last edited by this external user
      (itemMetadata.last_edited_by_type === 'external_user' && itemMetadata.last_edited_by_name?.includes(userContext.publicUserName)) ||
      (itemMetadata.last_edited_by_type === 'sub_user' && itemMetadata.last_edited_by_name === userContext.publicUserName) ||
      // Legacy data without creator info
      (!itemMetadata.created_by_type && !itemMetadata.created_by_name && itemMetadata.user_id === boardOwnerId)
    );
    
    console.log('🔍 Public mode permission result:', canEdit);
    return canEdit;
  }

  // For authenticated sub-users
  if (userContext.isAuthenticated && userContext.isSubUser && userContext.email) {
    // Get sub-user info from database to match against fullname
    const canEdit = (
      // Check if created by this sub-user (compare with email OR fullname)
      (itemMetadata.created_by_type === 'sub_user' && 
       (itemMetadata.created_by_name === userContext.email || 
        itemMetadata.created_by_name === userContext.fullname)) ||
      // Check if last edited by this sub-user
      (itemMetadata.last_edited_by_type === 'sub_user' && 
       (itemMetadata.last_edited_by_name === userContext.email || 
        itemMetadata.last_edited_by_name === userContext.fullname)) ||
      // Legacy data without metadata
      (!itemMetadata.created_by_type && !itemMetadata.created_by_name && 
       !itemMetadata.last_edited_by_type && !itemMetadata.last_edited_by_name)
    );

    console.log('🔍 Authenticated sub-user permission result:', canEdit);
    return canEdit;
  }

  console.log('❌ Permission denied - no matching criteria');
  return false;
};

/**
 * Get metadata for creating new items
 */
export const getCreationMetadata = (userContext: UserContext) => {
  if (userContext.isPublicMode && userContext.publicUserName) {
    return {
      created_by_type: 'external_user',
      created_by_name: `${userContext.publicUserName} (Sub User)`,
      last_edited_by_type: 'external_user',
      last_edited_by_name: `${userContext.publicUserName} (Sub User)`,
    };
  }

  if (userContext.isAuthenticated && userContext.isSubUser && userContext.fullname) {
    return {
      created_by_type: 'sub_user',
      created_by_name: userContext.fullname,
      last_edited_by_type: 'sub_user',
      last_edited_by_name: userContext.fullname,
    };
  }

  // Admin or regular authenticated user
  return {
    created_by_type: 'admin',
    created_by_name: userContext.email || 'Admin',
    last_edited_by_type: 'admin',
    last_edited_by_name: userContext.email || 'Admin',
  };
};

/**
 * Get metadata for updating existing items
 */
export const getUpdateMetadata = (userContext: UserContext) => {
  if (userContext.isPublicMode && userContext.publicUserName) {
    return {
      last_edited_by_type: 'external_user',
      last_edited_by_name: `${userContext.publicUserName} (Sub User)`,
      last_edited_at: new Date().toISOString(),
    };
  }

  if (userContext.isAuthenticated && userContext.isSubUser && userContext.fullname) {
    return {
      last_edited_by_type: 'sub_user',
      last_edited_by_name: userContext.fullname,
      last_edited_at: new Date().toISOString(),
    };
  }

  // Admin or regular authenticated user
  return {
    last_edited_by_type: 'admin',
    last_edited_by_name: userContext.email || 'Admin',
    last_edited_at: new Date().toISOString(),
  };
};