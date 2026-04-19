import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Trash2, Tag, Lock, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const TypesProduit = () => {
  const { permissions } = useUser();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [formNom, setFormNom] = useState('');

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const response = await api.get('/types-produit');
      setTypes(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des types');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingType(null);
    setFormNom('');
    setDialogOpen(true);
  };

  const openEditDialog = (type) => {
    setEditingType(type);
    setFormNom(type.nom);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formNom.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    try {
      if (editingType) {
        // Update existing
        await api.put(`/types-produit/${editingType.id}`, { nom: formNom.trim() });
        toast.success('Type modifié avec succès');
      } else {
        // Create new
        await api.post('/types-produit', { nom: formNom.trim() });
        toast.success('Type créé avec succès');
      }
      setDialogOpen(false);
      setFormNom('');
      setEditingType(null);
      fetchTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/types-produit/${typeToDelete.id}`);
      toast.success('Type supprimé');
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
      fetchTypes();
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
            Mode lecture seule - La gestion des types de produit est désactivée
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            Types de produit
          </h1>
          <p className="text-gray-600">Gérer les types disponibles pour les produits</p>
        </div>
        {permissions.canCreate && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
            <Plus size={20} className="mr-2" />
            Ajouter un type
          </Button>
        )}
      </div>

      {types.length === 0 ? (
        <div className="text-center py-16">
          <Tag size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">Aucun type</h3>
          <p className="text-gray-500">Ajoutez votre premier type de produit</p>
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
              {types.map((type) => (
                <tr key={type.id}>
                  <td className="font-medium">{type.nom}</td>
                  <td className="text-gray-500">
                    {new Date(type.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center gap-2">
                      {permissions.canCreate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(type)}
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
                            setTypeToDelete(type);
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
              {editingType ? 'Modifier le type' : 'Nouveau type de produit'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nom du type</Label>
              <Input
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex: Stent, Cathéter, Prothèse..."
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              {editingType ? 'Modifier' : 'Créer'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le type <strong>{typeToDelete?.nom}</strong> ?
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

export default TypesProduit;
