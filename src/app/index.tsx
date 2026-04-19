import Screen from '../layouts/screen';
// import './App.css'

import { HashRouter, Route, Routes } from 'react-router-dom'
import ProductLayouts from '../layouts/product_layouts';
import ProductPage from '../pages/produits';



const Router = () => {
    //   const { USER } = useGlobalContext()
    //   const [infos, setter] = USER

    //   const usersession = JSON.parse(window.api.db.getsessionid())



    //   if () {
    //     return (
    //       <Routes>
    //         <Route element={<Screen />}>
    //           {/* <Route path="/" element={<Accueil />} />
    //           <Route path="/todos" element={<NotesPages />} />
    //           <Route path="/archives" element={<ArchivePages />} />
    //           <Route path="/groupes" element={<GroupeLayouts />}>
    //             <Route path="/groupes/dossier/:id" element={<DossierPage />} />
    //           </Route>
    //           <Route path="/settings" element={<Settings />} />
    //           <Route path="/telechargements" element={<div>Profile</div>} />
    //           <Route path="/note/:id" element={<EditorPage />} /> */}
    //         </Route>
    //       </Routes>
    //     )
    //   }

    return (
        // s
        <Routes>
            <Route element={<Screen />}>
                <Route path="/" element={<div>Accueil</div>} />
                <Route path="/produits" element={<ProductLayouts />} >
                    <Route path="/produits/collections/:id" element={<ProductPage />}>
                        <Route path="/produits/collections/:id?sous_collection=:sousId" element={<ProductPage />} />
                    </Route>
                    <Route path="/produits/:productId" element={<ProductPage />} />
                </Route>
                {/* <Route path="/archives" element={<ArchivePages />} />
          <Route path="/groupes" element={<GroupeLayouts />}>
            <Route path="/groupes/dossier/:id" element={<DossierPage />} />
          </Route>
          <Route path="/settings" element={<Settings />} />
          <Route path="/telechargements" element={<div>Profile</div>} />
          <Route path="/note/:id" element={<EditorPage />} /> */}
            </Route>
        </Routes>
    )


}

export default function App() {

    return (
        <HashRouter basename='/'>
            <Router />
            {/* <GlobalProvider>
                <DatabaseProvider>
                </DatabaseProvider>
            </GlobalProvider> */}
        </HashRouter>
    )

}

