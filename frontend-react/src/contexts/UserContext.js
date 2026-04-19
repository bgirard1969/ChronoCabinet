import React, { createContext, useContext } from 'react';

const UserContext = createContext(null);

export const UserProvider = ({ user, children }) => {
  // Define permissions based on role
  const getPermissions = (role) => {
    switch (role) {
      case 'administrateur':
        return {
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canApprove: true,
          canManageEmployees: true,
          canPick: true,
          canReceive: true,
          canRestock: true,
          isReadOnly: false
        };
      case 'gestionnaire':
        return {
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canApprove: true,
          canManageEmployees: false,
          canPick: true,
          canReceive: true,
          canRestock: true,
          isReadOnly: false
        };
      case 'technicien':
        return {
          canCreate: true,
          canEdit: true,
          canDelete: false,
          canApprove: false,
          canManageEmployees: false,
          canPick: true,
          canReceive: true,
          canRestock: true,
          isReadOnly: false
        };
      case 'clinicien':
        return {
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canApprove: false,
          canManageEmployees: false,
          canPick: true,
          canReceive: false,
          canRestock: false,
          isReadOnly: false
        };
      case 'lecture':
        return {
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canApprove: false,
          canManageEmployees: false,
          canPick: false,
          canReceive: false,
          canRestock: false,
          isReadOnly: true
        };
      default:
        return {
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canApprove: false,
          canManageEmployees: false,
          canPick: false,
          canReceive: false,
          canRestock: false,
          isReadOnly: true
        };
    }
  };

  const permissions = user ? getPermissions(user.role) : getPermissions(null);

  return (
    <UserContext.Provider value={{ user, permissions }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
