import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Trash2, Building2, Lock, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUser } from '@/contexts/UserContext';

const Fabricants = () => {
  const { permissions } = useUser();
  const [fabricants, setFabricants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fabricantToDelete, setFabricantToDelete] = useState(null);
  const [editingFabricant, setEditingFabricant] = useState(null);
  const [formNom, setFormNom] = useState('');

  useEffect(() => {
    fetchFabricants();
  }, []);

  const fetchFabricants = async () => {
    try {
      const response = await api.get('/fabricants');
      setFabricants(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingFabricant(null);
    setFormNom('');
    setDialogOpen(true);
  };

  const openEditDialog = (fabricant) => {
    setEditingFabricant(fabricant);
    setFormNom(fabricant.nom);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formNom.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    try {
      if (editingFabricant) {
        // Update existing
        await api.put(`/fabricants/${editingFabricant.id}`, { nom: formNom.trim() });
        toast.success('Fournisseur modifié avec succès');
      } else {
        // Create new
        await api.post('/fabricants', { nom: formNom.trim() });
        toast.success('Fournisseur créé avec succès');
      }
      setDialogOpen(false);
      setFormNom('');
      setEditingFabricant(null);
      fetchFabricants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/fabricants/${fabricantToDelete.id}`);
      toast.success('Fournisseur supprimé');
      setDeleteDialogOpen(false);
      setFabricantToDelete(null);
      fetchFabricants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            Mode lecture seule - La gestion des fournisseurs est désactivée
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            Fournisseurs
          </h1>
          <p className="text-gray-600">Gérer les fournisseurs disponibles pour les produits</p>
        </div>
        {permissions.canCreate && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
            <Plus size={20} className="mr-2" />
            Ajouter un fournisseur
          </Button>
        )}
      </div>

      {fabricants.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">Aucun fournisseur</h3>
          <p className="text-gray-500">Ajoutez votre premier fournisseur</p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: '60%' }}>Nom</th>
                <th style={{ width: '25%' }}>Date création</th>
                <th style={{ width: '15%' }} className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fabricants.map((fabricant) => (
                <tr key={fabricant.id}>
                  <td className="font-medium">{fabricant.nom}</td>
                  <td className="text-gray-500">
                    {new Date(fabricant.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center gap-2">
                      {permissions.canCreate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(fabricant)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit size={16} />
                        </Button>
                      )}
                      {permissions.canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFabricantToDelete(fabricant);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFabricant ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nom du fournisseur</Label>
              <Input
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex: Boston Scientific, Medtronic..."
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              {editingFabricant ? 'Modifier' : 'Créer'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le fournisseur <strong>{fabricantToDelete?.nom}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Fabricants;
