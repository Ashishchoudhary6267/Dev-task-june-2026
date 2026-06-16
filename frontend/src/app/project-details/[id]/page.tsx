// 'use client'

// import React from 'react'
// import { useParams } from 'next/navigation';
// import { useEffect } from 'react';
// import { useProjectStore } from '@/lib/zustand/projects/createproject';

// const ProjectDetailsPage = () => {
//     const params = useParams();
//     const id = params?.id as string;

//     const { fetchprojectbyid, detailedProject, projectsloading } = useProjectStore();

//     useEffect(() => {
//         if (id) {
//             fetchprojectbyid(id);
//         }
//     }, [id]);
//     return (
//         <div className="p-6">
//             <h1 className="text-2xl font-bold mb-4">Project Details</h1>

//             {projectsloading ? (
//                 <p>Loading project details...</p>
//             ) : detailedProject ? (
//                 <div className="space-y-4">
//                     <p><strong>Name:</strong> {detailedProject.name}</p>
//                     <p><strong>Client:</strong> {detailedProject.client_name}</p>
//                     <p><strong>Description:</strong> {detailedProject.description}</p>
//                     <p><strong>Status:</strong> {detailedProject.status}</p>
//                 </div>
//             ) : (
//                 <p>Project not found or failed to load.</p>
//             )}
//         </div>
//     )
// }

// export default ProjectDetailsPage;

import React from 'react'

const ProjectDetailsPage = () => {
    return (
        <div>ProjectDetailsPage</div>
    )
}

export default ProjectDetailsPage