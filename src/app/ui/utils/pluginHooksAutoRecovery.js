import { useState, useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import renderRecoveryModal from './renderRecoveryModal';

// this is an example of hooks plugin
export function useRecoveringProject(headType) {
    const findLastEnvironment = useSelector(state => state?.project[headType].findLastEnvironment, shallowEqual);
    // const openedFile = useSelecto`r(state => state?.project[headType].openedFile, shallowEqual);
    // UniApi.Window.setOpenedFile(o`penedFile ? openedFile.name : undefined);

    const [recoveringProject, setRecoveringProject] = useState(findLastEnvironment);

    useEffect(() => {
        if (findLastEnvironment) {
            setRecoveringProject(true);
        }
    }, [findLastEnvironment]);

    return [recoveringProject, setRecoveringProject];
}
export function useRenderRecoveryModal(page) {
    const [recoveringProject, setRecoveringProject] = useRecoveringProject(page);
    return recoveringProject && renderRecoveryModal(page, () => { setRecoveringProject(false); });
}

export default {
    useRecoveringProject,
    useRenderRecoveryModal
};
